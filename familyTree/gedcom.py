"""Minimal GEDCOM 5.5 export/import: individuals, names, sex, birth/death date+place, occupation, families.

ponytail: adoptive parents, notes, media and partial dates (ABT 1900, 1900) are not carried; add when needed.
"""
import re
from datetime import date

from django.db import transaction

from .models import Person, Relationship

MONTHS = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
LINE_RE = re.compile(r"^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$")
NAME_RE = re.compile(r"^(.*?)/(.*?)/(.*)$")


def format_date(value):
    return f"{value.day} {MONTHS[value.month - 1]} {value.year}"


def parse_date(raw):
    raw = (raw or "").strip().upper()
    match = re.fullmatch(r"(\d{1,2}) ([A-Z]{3}) (\d{3,4})", raw)
    try:
        if match and match.group(2) in MONTHS:
            return date(int(match.group(3)), MONTHS.index(match.group(2)) + 1, int(match.group(1)))
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _family_key(a, b):
    """Order a couple as (husband, wife) when gender says so, else by id."""
    if a.gender == "F" or b.gender == "M":
        a, b = b, a
    return a.id, b.id


def export_gedcom(people, relationships):
    by_id = {person.id: person for person in people}
    indi = {person.id: f"@I{person.id}@" for person in people}

    # family key: (husband_id or None, wife_id or None) -> set of child ids
    families = {}
    for person in people:
        if person.father_id or person.mother_id:
            families.setdefault((person.father_id, person.mother_id), set()).add(person.id)

    couples = {(r.person1_id, r.person2_id) for r in relationships}
    for person in people:
        for field in Person.PARTNER_FIELDS:
            partner_id = getattr(person, f"{field}_id")
            if partner_id:
                couples.add((person.id, partner_id))
    for a_id, b_id in couples:
        if a_id not in by_id or b_id not in by_id:
            continue
        key = _family_key(by_id[a_id], by_id[b_id])
        if key[::-1] in families:
            key = key[::-1]
        families.setdefault(key, set())

    fam_ids = {key: f"@F{index}@" for index, key in enumerate(families, start=1)}
    famc, fams = {}, {}
    for key, children in families.items():
        for parent_id in key:
            if parent_id:
                fams.setdefault(parent_id, []).append(fam_ids[key])
        for child_id in children:
            famc.setdefault(child_id, []).append(fam_ids[key])

    lines = ["0 HEAD", "1 SOUR FamilyTreeApp", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8"]
    for person in people:
        lines.append(f"0 {indi[person.id]} INDI")
        lines.append(f"1 NAME {person.first_name} /{person.last_name}/")
        lines.append(f"1 SEX {person.gender if person.gender in ('M', 'F') else 'U'}")
        for tag, when, where in (("BIRT", person.birth_date, person.birth_place), ("DEAT", person.death_date, person.death_place)):
            if when or where:
                lines.append(f"1 {tag}")
                if when:
                    lines.append(f"2 DATE {format_date(when)}")
                if where:
                    lines.append(f"2 PLAC {where}")
        if person.occupation:
            lines.append(f"1 OCCU {person.occupation}")
        lines += [f"1 FAMC {fam}" for fam in famc.get(person.id, [])]
        lines += [f"1 FAMS {fam}" for fam in fams.get(person.id, [])]

    for key, children in families.items():
        husband_id, wife_id = key
        lines.append(f"0 {fam_ids[key]} FAM")
        if husband_id:
            lines.append(f"1 HUSB {indi[husband_id]}")
        if wife_id:
            lines.append(f"1 WIFE {indi[wife_id]}")
        lines += [f"1 CHIL {indi[child_id]}" for child_id in sorted(children)]

    lines.append("0 TRLR")
    return "\n".join(lines) + "\n"


def _parse_records(text):
    """Yield (xref, tag, [(level, tag, value), ...]) for every level-0 record."""
    record = None
    for line in text.splitlines():
        match = LINE_RE.match(line)
        if not match:
            continue
        level, xref, tag, value = int(match.group(1)), match.group(2), match.group(3), (match.group(4) or "").strip()
        if level == 0:
            if record:
                yield record
            record = (xref, tag, [])
        elif record:
            record[2].append((level, tag, value))
    if record:
        yield record


@transaction.atomic
def import_gedcom(text):
    """Create people and family links from GEDCOM text. Returns the number of people created."""
    individuals, families = {}, []
    for xref, tag, lines in _parse_records(text):
        if tag == "INDI":
            data = {"first_name": "", "last_name": "", "gender": "O"}
            event = None
            for level, sub_tag, value in lines:
                if level == 1:
                    event = sub_tag
                    if sub_tag == "NAME" and not data["first_name"]:
                        match = NAME_RE.match(value)
                        data["first_name"], data["last_name"] = (match.group(1).strip(), match.group(2).strip()) if match else (value, "")
                    elif sub_tag == "SEX":
                        data["gender"] = value if value in ("M", "F") else "O"
                    elif sub_tag == "OCCU":
                        data["occupation"] = value
                elif level == 2 and event in ("BIRT", "DEAT"):
                    prefix = "birth" if event == "BIRT" else "death"
                    if sub_tag == "DATE":
                        data[f"{prefix}_date"] = parse_date(value)
                    elif sub_tag == "PLAC":
                        data[f"{prefix}_place"] = value
            if data["first_name"]:
                individuals[xref] = data
        elif tag == "FAM":
            fam = {"HUSB": None, "WIFE": None, "CHIL": []}
            for level, sub_tag, value in lines:
                if level == 1 and sub_tag in ("HUSB", "WIFE"):
                    fam[sub_tag] = value
                elif level == 1 and sub_tag == "CHIL":
                    fam["CHIL"].append(value)
            families.append(fam)

    people = {xref: Person.objects.create(**data) for xref, data in individuals.items()}

    for fam in families:
        husband, wife = people.get(fam["HUSB"]), people.get(fam["WIFE"])
        for child_xref in fam["CHIL"]:
            child = people.get(child_xref)
            if child:
                child.father = child.father or husband
                child.mother = child.mother or wife
                child.save(update_fields=["father", "mother"])
        if husband and wife:
            low, high = sorted([husband.id, wife.id])
            Relationship.objects.get_or_create(person1_id=low, person2_id=high, relationship_type="MARRIAGE", start_date=None)

    return len(people)
