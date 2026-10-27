from collections import defaultdict, deque
from contextlib import closing
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
import io
import os
import re
import shutil
import sqlite3
import tempfile
import zipfile

from django.conf import settings
from django.core.management import call_command
from django.core.serializers.base import DeserializationError
from django.db import IntegrityError, connection, connections, transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from . import gedcom
from .models import Person, PersonMedia, Relationship
from .serializers import PersonMediaSerializer, PersonSerializer, RelationshipSerializer


def _safe_extract_zip(zip_ref: zipfile.ZipFile, extract_dir: Path) -> None:
	extract_dir = extract_dir.resolve()
	for member in zip_ref.infolist():
		if not (extract_dir / member.filename).resolve().is_relative_to(extract_dir):
			raise ValueError("Invalid archive structure")
	zip_ref.extractall(extract_dir)


def _age(birth_date, on_date):
	return on_date.year - birth_date.year - ((on_date.month, on_date.day) < (birth_date.month, birth_date.day))


def _parse_date_param(raw_value):
	if not raw_value:
		return None
	try:
		return date.fromisoformat(raw_value)
	except ValueError:
		return None


def _normalize_text(value):
	if value is None:
		return ""
	return re.sub(r"\s+", " ", str(value).strip().lower())


def _parse_bool(raw_value, default=True):
	if raw_value is None:
		return default
	return str(raw_value).strip().lower() not in {"0", "false", "no", "off"}


def _build_family_adjacency(people, relationships):
	graph = defaultdict(set)

	for person in people:
		for field in Person.LINK_FIELDS:
			linked_id = getattr(person, f"{field}_id")
			if linked_id:
				graph[person.id].add(linked_id)
				graph[linked_id].add(person.id)

	for relationship in relationships:
		graph[relationship.person1_id].add(relationship.person2_id)
		graph[relationship.person2_id].add(relationship.person1_id)

	return graph


def _collect_branch_ids(root_id, graph, depth_limit=None):
	if not root_id:
		return None

	visited = set()
	queue = deque([(root_id, 0)])

	while queue:
		current_id, level = queue.popleft()
		if current_id in visited:
			continue
		visited.add(current_id)

		if depth_limit is not None and level >= depth_limit:
			continue

		for neighbor_id in graph.get(current_id, set()):
			if neighbor_id not in visited:
				queue.append((neighbor_id, level + 1))

	return visited


MIN_NAME_SIMILARITY = 0.68  # below this two names are never offered as duplicates
MAX_DUPLICATE_BONUS = 0.26 + 0.08  # same birth date + same birth place


class PersonViewSet(viewsets.ModelViewSet):
	queryset = Person.objects.select_related(*Person.LINK_FIELDS)
	serializer_class = PersonSerializer
	parser_classes = [MultiPartParser, FormParser, JSONParser]

	RELATION_ALIASES = {
		"aunts": "aunt",
		"brothers": "brother",
		"children": "child",
		"cousins": "cousin",
		"dad": "father",
		"daughters": "daughter",
		"familyname": "last_name",
		"granddad": "grandpa",
		"grandfather": "grandpa",
		"grandma": "grandma",
		"grandmother": "grandma",
		"grandpa": "grandpa",
		"grandparents": "grandparent",
		"grandchildren": "grandchild",
		"husbands": "husband",
		"mom": "mother",
		"mum": "mother",
		"nephews": "nephew",
		"nieces": "niece",
		"partners": "partner",
		"relatives": "relative",
		"siblings": "sibling",
		"sisters": "sister",
		"sons": "son",
		"spouses": "spouse",
		"surname": "last_name",
		"uncles": "uncle",
		"wives": "wife",
		"lastname": "last_name",
		# Arabic (the UI defaults to Arabic)
		"أم": "mother", "ام": "mother", "أمهات": "mother",
		"أب": "father", "اب": "father", "آباء": "father",
		"ابن": "son", "ابنة": "daughter", "أبناء": "child", "بنات": "daughter",
		"أخ": "brother", "اخ": "brother", "أخت": "sister", "اخت": "sister",
		"إخوة": "sibling", "اخوة": "sibling", "أخوات": "sister",
		"زوج": "husband", "زوجة": "wife", "أزواج": "spouse", "شريك": "partner", "شريكة": "partner",
		"جد": "grandpa", "جدة": "grandma", "أجداد": "grandparent",
		"حفيد": "grandchild", "حفيدة": "grandchild", "أحفاد": "grandchild",
		"عمة": "aunt", "عمات": "aunt", "خالة": "aunt", "خالات": "aunt",
		"عم": "uncle", "أعمام": "uncle", "خال": "uncle", "أخوال": "uncle",
		"ابن_عم": "cousin", "ابن_خال": "cousin",
		"قريب": "relative", "أقارب": "relative",
		"لقب": "last_name", "العائلة": "last_name",
	}
	IGNORED_SEARCH_WORDS = {
		"all",
		"and",
		"by",
		"family",
		"last_name",
		"name",
		"relation",
		"relationships",
		"relative",
		"و", "كل", "حسب", "اسم", "الاسم", "العلاقات", "علاقة",
	}

	def _normalize_search_tokens(self, raw_query):
		query = (raw_query or "").strip().lower()
		if not query:
			return []

		tokens = []
		for token in re.split(r"[\s,;/]+", query):
			if not token:
				continue

			normalized = self.RELATION_ALIASES.get(token, token)
			if normalized in self.IGNORED_SEARCH_WORDS:
				continue
			tokens.append(normalized)

		return tokens

	def _build_family_maps(self, people, relationships):
		parents_by_person = {}
		children_by_parent = defaultdict(set)
		partners_by_person = defaultdict(set)

		for person in people:
			parent_ids = {getattr(person, f"{field}_id") for field in Person.PARENT_FIELDS} - {None}
			parents_by_person[person.id] = parent_ids
			for pid in parent_ids:
				children_by_parent[pid].add(person.id)

			for field in Person.PARTNER_FIELDS:
				partner_id = getattr(person, f"{field}_id")
				if partner_id:
					partners_by_person[person.id].add(partner_id)
					partners_by_person[partner_id].add(person.id)

		for relationship in relationships:
			partners_by_person[relationship.person1_id].add(relationship.person2_id)
			partners_by_person[relationship.person2_id].add(relationship.person1_id)

		siblings_by_person = {}
		for person in people:
			siblings = set()
			for parent_id in parents_by_person.get(person.id, set()):
				siblings.update(children_by_parent.get(parent_id, set()))
			siblings.discard(person.id)
			siblings_by_person[person.id] = siblings

		tags_by_person = {}
		for person in people:
			tags = set()
			parents = parents_by_person.get(person.id, set())
			children = children_by_parent.get(person.id, set())
			siblings = siblings_by_person.get(person.id, set())
			partners = partners_by_person.get(person.id, set())

			if parents:
				tags.add("child")
				if person.gender == "M":
					tags.add("son")
				elif person.gender == "F":
					tags.add("daughter")

			if children:
				tags.add("parent")
				if person.gender == "M":
					tags.add("father")
				elif person.gender == "F":
					tags.add("mother")

			if siblings:
				tags.add("sibling")
				if person.gender == "M":
					tags.add("brother")
				elif person.gender == "F":
					tags.add("sister")

			has_grandchildren = any(children_by_parent.get(child_id) for child_id in children)
			if has_grandchildren:
				tags.add("grandparent")
				if person.gender == "M":
					tags.add("grandpa")
				elif person.gender == "F":
					tags.add("grandma")

			has_grandparents = any(parents_by_person.get(parent_id) for parent_id in parents)
			if has_grandparents:
				tags.add("grandchild")

			has_niece_or_nephew = any(children_by_parent.get(sibling_id) for sibling_id in siblings)
			if has_niece_or_nephew:
				if person.gender == "F":
					tags.add("aunt")
				elif person.gender == "M":
					tags.add("uncle")
				else:
					tags.update({"aunt", "uncle"})

			has_parent_siblings = any(siblings_by_person.get(parent_id) for parent_id in parents)
			if has_parent_siblings:
				if person.gender == "F":
					tags.add("niece")
				elif person.gender == "M":
					tags.add("nephew")
				else:
					tags.update({"niece", "nephew"})

			has_cousins = False
			for parent_id in parents:
				for parent_sibling_id in siblings_by_person.get(parent_id, set()):
					cousin_ids = children_by_parent.get(parent_sibling_id, set())
					if any(cousin_id != person.id for cousin_id in cousin_ids):
						has_cousins = True
						break
				if has_cousins:
					break
			if has_cousins:
				tags.add("cousin")

			if partners:
				tags.update({"partner", "spouse"})
				if person.gender == "M":
					tags.add("husband")
				elif person.gender == "F":
					tags.add("wife")

			step_children = set()
			for partner_id in partners:
				partner_children = children_by_parent.get(partner_id, set())
				step_children.update(child_id for child_id in partner_children if child_id not in children)
			if step_children:
				tags.add("step_parent")

			step_parents = set()
			for parent_id in parents:
				for parent_partner_id in partners_by_person.get(parent_id, set()):
					if parent_partner_id not in parents:
						step_parents.add(parent_partner_id)
			if step_parents:
				tags.add("step_child")

			tags_by_person[person.id] = tags

		return {
			"parents_by_person": parents_by_person,
			"children_by_parent": children_by_parent,
			"partners_by_person": partners_by_person,
			"tags_by_person": tags_by_person,
		}

	def _compute_search_score(self, payload, tokens):
		if not tokens:
			return 0

		full_name = _normalize_text(f"{payload.get('first_name') or ''} {payload.get('last_name') or ''}")
		search_buckets = [
			(_normalize_text(payload.get("first_name")), 4),
			(_normalize_text(payload.get("last_name")), 4),
			(full_name, 6),
			(_normalize_text(payload.get("mother_name")), 2),
			(_normalize_text(payload.get("father_name")), 2),
			(_normalize_text(payload.get("spouse_name")), 2),
			(_normalize_text(payload.get("husband_name")), 2),
			(_normalize_text(payload.get("wife_name")), 2),
			(_normalize_text(payload.get("birth_place")), 3),
			(_normalize_text(payload.get("death_place")), 2),
			(_normalize_text(payload.get("occupation")), 2),
			(_normalize_text(payload.get("biography")), 1),
		]
		tag_buckets = [_normalize_text(tag) for tag in payload.get("relation_tags", [])]

		total_score = 0
		for token in tokens:
			token_normalized = _normalize_text(token)
			token_score = 0

			for value, base_weight in search_buckets:
				if not value or token_normalized not in value:
					continue
				token_score = max(token_score, base_weight)
				if value == token_normalized:
					token_score = max(token_score, base_weight + 2)
				elif value.startswith(token_normalized):
					token_score = max(token_score, base_weight + 1)

			if any(token_normalized in value for value in tag_buckets):
				token_score = max(token_score, 5)

			if token_score <= 0:
				return -1

			total_score += token_score

		return total_score

	def _detect_duplicate_pairs(self, people, threshold):
		def summary(person):
			return {
				"id": person.id,
				"name": str(person),
				"birth_date": person.birth_date.isoformat() if person.birth_date else None,
				"birth_place": person.birth_place,
			}

		# (original position, person, name, place), shortest names first: real_quick_ratio() only depends on the
		# two lengths, so once a longer name can no longer reach the bar, no later one can either.
		entries = sorted(
			(
				(position, person, _normalize_text(f"{person.first_name} {person.last_name}"), _normalize_text(person.birth_place))
				for position, person in enumerate(people)
			),
			key=lambda entry: len(entry[2]),
		)
		entries = [entry for entry in entries if entry[2]]
		lowest_required = max(MIN_NAME_SIMILARITY, threshold - MAX_DUPLICATE_BONUS)

		pairs = []
		for index, (left_position, left, left_name, left_place) in enumerate(entries):
			# SequenceMatcher caches work for seq2, so the outer name goes there.
			matcher = SequenceMatcher(None, autojunk=False)
			matcher.set_seq2(left_name)
			for right_position, right, right_name, right_place in entries[index + 1:]:
				if 2 * len(left_name) / (len(left_name) + len(right_name)) < lowest_required:
					break

				bonus = 0.0
				if left.birth_date and right.birth_date:
					if left.birth_date == right.birth_date:
						bonus += 0.26
					elif left.birth_date.year == right.birth_date.year:
						bonus += 0.1
				if left_place and left_place == right_place:
					bonus += 0.08

				# real_quick_ratio and quick_ratio are cheap, symmetric upper bounds of ratio(): skipping on them never
				# drops a match.
				required = max(MIN_NAME_SIMILARITY, threshold - bonus)
				matcher.set_seq1(right_name)
				if matcher.real_quick_ratio() < required or matcher.quick_ratio() < required:
					continue
				# ratio() itself is asymmetric, so compare in the caller's order (the merge UI keeps the "left" person).
				if left_position < right_position:
					first, second, name_score = left, right, SequenceMatcher(None, left_name, right_name, autojunk=False).ratio()
				else:
					first, second, name_score = right, left, matcher.ratio()
				if name_score < required:
					continue

				pairs.append({"score": round(min(1.0, name_score + bonus), 3), "left": summary(first), "right": summary(second)})

		pairs.sort(key=lambda item: item["score"], reverse=True)
		return pairs

	def _merge_person_into(self, primary, duplicate):
		if primary.gender == "O" and duplicate.gender in {"M", "F"}:
			primary.gender = duplicate.gender

		fill_if_empty = ["last_name", "photo", "birth_date", "death_date", "birth_place", "death_place", "occupation"]
		fill_if_empty += [f"{field}_id" for field in Person.LINK_FIELDS]
		for field_name in fill_if_empty:
			if not getattr(primary, field_name) and getattr(duplicate, field_name):
				setattr(primary, field_name, getattr(duplicate, field_name))

		# Neither person may end up linked to themselves or to the soon-deleted duplicate.
		for field in Person.LINK_FIELDS:
			if getattr(primary, f"{field}_id") in (primary.id, duplicate.id):
				setattr(primary, f"{field}_id", None)

		if duplicate.biography:
			if not primary.biography:
				primary.biography = duplicate.biography
			elif duplicate.biography.strip() not in primary.biography:
				primary.biography = f"{primary.biography}\n\n{duplicate.biography}".strip()

		primary.save()

		for field_name in Person.LINK_FIELDS:
			Person.objects.exclude(id=primary.id).filter(**{field_name: duplicate}).update(**{field_name: primary})

		for relationship in Relationship.objects.filter(person1=duplicate) | Relationship.objects.filter(person2=duplicate):
			left_id = primary.id if relationship.person1_id == duplicate.id else relationship.person1_id
			right_id = primary.id if relationship.person2_id == duplicate.id else relationship.person2_id

			if left_id == right_id:
				relationship.delete()
				continue

			low_id, high_id = sorted([left_id, right_id])
			existing = Relationship.objects.filter(
				person1_id=low_id,
				person2_id=high_id,
				relationship_type=relationship.relationship_type,
				start_date=relationship.start_date,
			).exclude(id=relationship.id).first()

			if existing:
				updated_fields = []
				if not existing.end_date and relationship.end_date:
					existing.end_date = relationship.end_date
					updated_fields.append("end_date")
				if not existing.notes and relationship.notes:
					existing.notes = relationship.notes
					updated_fields.append("notes")
				if existing.status == "ACTIVE" and relationship.status != "ACTIVE":
					existing.status = relationship.status
					updated_fields.append("status")
				if updated_fields:
					existing.save(update_fields=updated_fields)
				relationship.delete()
				continue

			relationship.person1_id = low_id
			relationship.person2_id = high_id
			relationship.save()

		PersonMedia.objects.filter(person=duplicate).update(person=primary)
		duplicate.delete()

	def list(self, request, *args, **kwargs):
		people = list(Person.objects.select_related(*Person.LINK_FIELDS))
		relationships = list(Relationship.objects.all())
		family_maps = self._build_family_maps(people, relationships)
		relation_tags_by_person = family_maps["tags_by_person"]
		partners_by_person = family_maps["partners_by_person"]

		raw_query = request.query_params.get("q")
		tokens = self._normalize_search_tokens(raw_query)
		smart_search = _parse_bool(request.query_params.get("smart"), default=True)

		birth_from = _parse_date_param(request.query_params.get("birth_from"))
		birth_to = _parse_date_param(request.query_params.get("birth_to"))
		death_from = _parse_date_param(request.query_params.get("death_from"))
		death_to = _parse_date_param(request.query_params.get("death_to"))
		location_filter = _normalize_text(request.query_params.get("location"))
		living_status = _normalize_text(request.query_params.get("living"))

		branch_root = request.query_params.get("branch_root")
		branch_depth_raw = request.query_params.get("branch_depth")
		branch_depth = int(branch_depth_raw) if branch_depth_raw and branch_depth_raw.isdigit() else None
		branch_root_id = int(branch_root) if branch_root and str(branch_root).isdigit() else None

		graph = _build_family_adjacency(people, relationships)
		branch_ids = _collect_branch_ids(branch_root_id, graph, depth_limit=branch_depth)

		limit_raw = request.query_params.get("limit")
		limit = None
		if limit_raw and str(limit_raw).isdigit():
			limit = max(1, int(limit_raw))

		data = []
		for person in people:
			if branch_ids is not None and person.id not in branch_ids:
				continue

			if birth_from and (not person.birth_date or person.birth_date < birth_from):
				continue
			if birth_to and (not person.birth_date or person.birth_date > birth_to):
				continue
			if death_from and (not person.death_date or person.death_date < death_from):
				continue
			if death_to and (not person.death_date or person.death_date > death_to):
				continue

			if living_status == "living" and person.death_date:
				continue
			if living_status == "deceased" and not person.death_date:
				continue

			if location_filter:
				birth_place = _normalize_text(person.birth_place)
				death_place = _normalize_text(person.death_place)
				if location_filter not in birth_place and location_filter not in death_place:
					continue

			photo_url = None
			if person.photo and hasattr(person.photo, "url"):
				try:
					photo_url = request.build_absolute_uri(person.photo.url)
				except Exception:
					photo_url = person.photo.url

			payload = {
				"id": person.id,
				"first_name": person.first_name,
				"last_name": person.last_name,
				"gender": person.gender,
				"birth_date": person.birth_date.isoformat() if person.birth_date else None,
				"death_date": person.death_date.isoformat() if person.death_date else None,
				"birth_place": person.birth_place,
				"death_place": person.death_place,
				"occupation": person.occupation,
				"biography": person.biography,
				"mother": person.mother_id,
				"father": person.father_id,
				"adoptive_mother": person.adoptive_mother_id,
				"adoptive_father": person.adoptive_father_id,
				"spouse": person.spouse_id,
				"husband": person.husband_id,
				"wife": person.wife_id,
				"partners": sorted(partners_by_person.get(person.id, set())),
				"mother_name": str(person.mother) if person.mother else None,
				"father_name": str(person.father) if person.father else None,
				"adoptive_mother_name": str(person.adoptive_mother) if person.adoptive_mother else None,
				"adoptive_father_name": str(person.adoptive_father) if person.adoptive_father else None,
				"spouse_name": str(person.spouse) if person.spouse else None,
				"husband_name": str(person.husband) if person.husband else None,
				"wife_name": str(person.wife) if person.wife else None,
				"relation_tags": sorted(relation_tags_by_person.get(person.id, set())),
				"photo_url": photo_url,
			}

			score = self._compute_search_score(payload, tokens)
			if score < 0:
				continue
			payload["search_score"] = score
			data.append(payload)

		if tokens and smart_search:
			data.sort(key=lambda item: (-item.get("search_score", 0), _normalize_text(item.get("last_name")), _normalize_text(item.get("first_name"))))

		total = len(data)
		if limit is not None:
			data = data[:limit]

		return Response(data, headers={"X-Total-Count": str(total)})

	@action(detail=False, methods=["get"])
	def duplicates(self, request):
		threshold_raw = request.query_params.get("threshold")
		try:
			threshold = float(threshold_raw) if threshold_raw is not None else 0.82
		except ValueError:
			threshold = 0.82
		threshold = max(0.6, min(threshold, 0.98))

		people = list(Person.objects.all().order_by("last_name", "first_name", "id"))
		return Response({"threshold": threshold, "pairs": self._detect_duplicate_pairs(people, threshold)})

	@action(detail=False, methods=["post"])
	def merge(self, request):
		primary_id = request.data.get("primary_id")
		duplicate_ids = request.data.get("duplicate_ids")
		if duplicate_ids is None:
			single_duplicate = request.data.get("duplicate_id")
			duplicate_ids = [single_duplicate] if single_duplicate is not None else []

		if not primary_id:
			return Response({"error": "primary_id is required"}, status=status.HTTP_400_BAD_REQUEST)

		try:
			primary_id = int(primary_id)
		except (TypeError, ValueError):
			return Response({"error": "primary_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

		if not isinstance(duplicate_ids, list):
			return Response({"error": "duplicate_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)

		parsed_duplicate_ids = []
		for duplicate_id in duplicate_ids:
			try:
				candidate_id = int(duplicate_id)
			except (TypeError, ValueError):
				continue
			if candidate_id != primary_id:
				parsed_duplicate_ids.append(candidate_id)

		parsed_duplicate_ids = sorted(set(parsed_duplicate_ids))
		if not parsed_duplicate_ids:
			return Response({"error": "At least one duplicate id is required"}, status=status.HTTP_400_BAD_REQUEST)

		people_map = {
			person.id: person
			for person in Person.objects.filter(id__in=[primary_id, *parsed_duplicate_ids])
		}
		primary = people_map.get(primary_id)
		if not primary:
			return Response({"error": "Primary person not found"}, status=status.HTTP_404_NOT_FOUND)

		missing_ids = [pid for pid in parsed_duplicate_ids if pid not in people_map]
		if missing_ids:
			return Response({"error": "Some duplicate ids do not exist", "missing_ids": missing_ids}, status=status.HTTP_404_NOT_FOUND)

		with transaction.atomic():
			for duplicate_id in parsed_duplicate_ids:
				# Re-fetch both: an earlier merge may have relinked or deleted rows they point to.
				primary.refresh_from_db()
				self._merge_person_into(primary, Person.objects.get(id=duplicate_id))
			primary.refresh_from_db()

		serializer = self.get_serializer(primary, context={"request": request})
		return Response({
			"status": "ok",
			"primary_id": primary.id,
			"merged_ids": parsed_duplicate_ids,
			"person": serializer.data,
		})

	@action(detail=False, methods=["get"])
	def birthdays(self, request):
		serializer = self.get_serializer(Person.birthdays_on(date.today()), many=True)
		return Response(serializer.data)


class RelationshipViewSet(viewsets.ModelViewSet):
	queryset = Relationship.objects.select_related("person1", "person2").all()
	serializer_class = RelationshipSerializer
	parser_classes = [MultiPartParser, FormParser, JSONParser]

	def get_queryset(self):
		queryset = super().get_queryset()
		person_id = self.request.query_params.get("person")
		status_value = self.request.query_params.get("status")
		relationship_type = self.request.query_params.get("type")

		if person_id and str(person_id).isdigit():
			person_id = int(person_id)
			queryset = queryset.filter(person1_id=person_id) | queryset.filter(person2_id=person_id)

		if status_value:
			queryset = queryset.filter(status=status_value)

		if relationship_type:
			queryset = queryset.filter(relationship_type=relationship_type)

		return queryset.order_by("-start_date", "-created_at", "id")


class PersonMediaViewSet(viewsets.ModelViewSet):
	queryset = PersonMedia.objects.select_related("person").all()
	serializer_class = PersonMediaSerializer
	parser_classes = [MultiPartParser, FormParser, JSONParser]


@api_view(["GET"])
def stats(request):
	people = list(Person.objects.all())
	total = len(people)
	deceased = sum(1 for person in people if person.death_date)
	living = total - deceased

	today = date.today()
	ages = [_age(person.birth_date, person.death_date or today) for person in people if person.birth_date]
	ages = [age for age in ages if age >= 0]

	avg_age = round(sum(ages) / len(ages), 1) if ages else None
	oldest = max(ages) if ages else None

	return Response(
		{
			"total_people": total,
			"living_people": living,
			"deceased_people": deceased,
			"average_age": avg_age,
			"oldest_age": oldest,
		}
	)


@api_view(["GET"])
def timeline(request):
	events = []
	for person in Person.objects.all():
		full_name = str(person)
		if person.birth_date:
			events.append(
				{
					"date": person.birth_date.isoformat(),
					"type": "birth",
					"title": f"Birth of {full_name}",
					"person_id": person.id,
					"person_name": full_name,
					"place": person.birth_place,
				}
			)
		if person.death_date:
			events.append(
				{
					"date": person.death_date.isoformat(),
					"type": "death",
					"title": f"Death of {full_name}",
					"person_id": person.id,
					"person_name": full_name,
					"place": person.death_place,
				}
			)

	events.sort(key=lambda item: item["date"])
	return Response(events)


@api_view(["GET"])
def export_gedcom(request):
	content = gedcom.export_gedcom(list(Person.objects.order_by("id")), list(Relationship.objects.all()))
	response = HttpResponse(content, content_type="text/plain; charset=utf-8")
	response["Content-Disposition"] = 'attachment; filename="family_tree.ged"'
	return response


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def import_gedcom(request):
	uploaded_file = request.FILES.get("gedcom")
	if not uploaded_file:
		return Response({"error": "gedcom file is required"}, status=status.HTTP_400_BAD_REQUEST)

	created = gedcom.import_gedcom(uploaded_file.read().decode("utf-8-sig", errors="replace"))
	if not created:
		return Response({"error": "No people found in GEDCOM file"}, status=status.HTTP_400_BAD_REQUEST)
	return Response({"status": "ok", "created": created})


def _validate_family_db(path):
	"""Raise sqlite3.DatabaseError unless `path` is an intact SQLite file holding this app's tables."""
	with closing(sqlite3.connect(path)) as db:
		if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
			raise sqlite3.DatabaseError("Database integrity check failed")
		if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (Person._meta.db_table,)).fetchone():
			raise sqlite3.DatabaseError("Not a FamilyTree database")


def _replace_family_data(fixture_path):
	"""Swap every person, relationship and media record for the contents of a dumpdata fixture, atomically."""
	with transaction.atomic():
		PersonMedia.objects.all().delete()
		Relationship.objects.all().delete()
		Person.objects.all().delete()
		call_command("loaddata", str(fixture_path), verbosity=0)  # also resets Postgres id sequences


def _sqlite_backup_to_fixture(sqlite_path, fixture_path):
	"""Read an old SQLite-only backup into a JSON fixture through a temporary second database connection."""
	alias = "familytree_import"
	connections.settings[alias] = {**connections.settings["default"], "ENGINE": "django.db.backends.sqlite3", "NAME": str(sqlite_path), "OPTIONS": {}}
	try:
		call_command("migrate", database=alias, interactive=False, verbosity=0)  # older backups may predate the schema
		call_command("dumpdata", "familyTree", database=alias, output=str(fixture_path), verbosity=0)
	finally:
		connections[alias].close()
		del connections[alias]  # drop the cached wrapper too, or the next import reuses a closed file path
		del connections.settings[alias]


@csrf_exempt
def export_tree(request):
	if request.method != "GET":
		return JsonResponse({"error": "Method not allowed"}, status=405)

	media_root = Path(settings.MEDIA_ROOT)
	buffer = io.BytesIO()
	with tempfile.TemporaryDirectory(prefix="familytree_export_") as temp_dir:
		# data.json restores on any database (desktop SQLite or hosted Postgres).
		fixture = Path(temp_dir) / "data.json"
		call_command("dumpdata", "familyTree", output=str(fixture), verbosity=0)

		with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
			archive.write(fixture, arcname="data.json")
			if connection.vendor == "sqlite":
				# Also the raw file, for older desktop versions. The backup API gives a consistent snapshot even while other requests write.
				snapshot = Path(temp_dir) / "db.sqlite3"
				connection.ensure_connection()
				with closing(sqlite3.connect(snapshot)) as target:
					connection.connection.backup(target)
				archive.write(snapshot, arcname="db.sqlite3")
			for root, _, files in os.walk(media_root):
				for file_name in files:
					abs_path = Path(root) / file_name
					archive.write(abs_path, arcname=str(Path("media") / abs_path.relative_to(media_root)))

	response = HttpResponse(buffer.getvalue(), content_type="application/zip")
	response["Content-Disposition"] = 'attachment; filename="family_tree_backup.zip"'
	return response


@csrf_exempt
def import_tree(request):
	if request.method != "POST":
		return JsonResponse({"error": "Method not allowed"}, status=405)

	backup = request.FILES.get("backup")
	if not backup:
		return JsonResponse({"error": "backup file is required"}, status=400)

	with tempfile.TemporaryDirectory(prefix="familytree_import_") as temp_dir:
		temp_dir = Path(temp_dir)
		try:
			with zipfile.ZipFile(backup) as archive:
				_safe_extract_zip(archive, temp_dir)
		except (zipfile.BadZipFile, ValueError):
			return JsonResponse({"error": "Invalid zip file"}, status=400)

		fixture = temp_dir / "data.json"
		imported_db = temp_dir / "db.sqlite3"
		if not fixture.exists() and not imported_db.exists():
			return JsonResponse({"error": "Backup contains neither data.json nor db.sqlite3"}, status=400)
		if not fixture.exists():
			try:
				_validate_family_db(imported_db)
			except sqlite3.DatabaseError as exc:
				return JsonResponse({"error": f"Invalid database in backup: {exc}"}, status=400)

		try:
			if fixture.exists():
				_replace_family_data(fixture)
			elif connection.vendor == "sqlite":
				# Restore through the live connection: SQLite locks the file, so concurrent requests never see a torn copy.
				connection.ensure_connection()
				with closing(sqlite3.connect(imported_db)) as source:
					source.backup(connection.connection)
				call_command("migrate", interactive=False, verbosity=0)  # older backups may predate the current schema
			else:
				converted = temp_dir / "converted.json"
				_sqlite_backup_to_fixture(imported_db, converted)
				_replace_family_data(converted)
		except (DeserializationError, IntegrityError, ValueError) as exc:
			return JsonResponse({"error": f"Invalid data in backup: {exc}"}, status=400)

		imported_media = temp_dir / "media"
		if imported_media.exists():
			# Copy next to the live folder first, then swap, so a failed copy never deletes current photos.
			media_root = Path(settings.MEDIA_ROOT)
			staged, previous = media_root.with_name("media.importing"), media_root.with_name("media.previous")
			shutil.rmtree(staged, ignore_errors=True)
			shutil.rmtree(previous, ignore_errors=True)
			shutil.copytree(imported_media, staged)
			if media_root.exists():
				media_root.rename(previous)
			staged.rename(media_root)
			shutil.rmtree(previous, ignore_errors=True)

	return JsonResponse({"status": "ok", "message": "Tree imported successfully"})


def dashboard(request):
	return render(request, "familyTree/dashboard.html")
