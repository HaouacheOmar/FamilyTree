from collections import defaultdict
from datetime import date
from difflib import SequenceMatcher
from collections import deque
from pathlib import Path
import io
import os
import re
import shutil
import tempfile
import zipfile

from django.conf import settings
from django.db import connection, transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .models import Person, PersonMedia, Relationship
from .serializers import PersonMediaSerializer, PersonSerializer, RelationshipSerializer


def _db_path() -> Path:
	return Path(settings.DATABASES["default"]["NAME"])


def _safe_extract_zip(zip_ref: zipfile.ZipFile, extract_dir: Path) -> None:
	extract_dir = extract_dir.resolve()
	for member in zip_ref.infolist():
		target = (extract_dir / member.filename).resolve()
		if not str(target).startswith(str(extract_dir)):
			raise ValueError("Invalid archive structure")
	zip_ref.extractall(extract_dir)


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
		pid = person.id
		for linked_id in (
			person.mother_id,
			person.father_id,
			person.adoptive_mother_id,
			person.adoptive_father_id,
			person.spouse_id,
			person.husband_id,
			person.wife_id,
		):
			if not linked_id:
				continue
			graph[pid].add(linked_id)
			graph[linked_id].add(pid)

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


def _name_similarity(left, right):
	left_normalized = _normalize_text(left)
	right_normalized = _normalize_text(right)
	if not left_normalized or not right_normalized:
		return 0.0
	if left_normalized == right_normalized:
		return 1.0
	return SequenceMatcher(None, left_normalized, right_normalized).ratio()


class PersonViewSet(viewsets.ModelViewSet):
	queryset = Person.objects.all()
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
	}
	IGNORED_SEARCH_WORDS = {
		"all",
		"and",
		"by",
		"family",
		"name",
		"relation",
		"relationships",
		"relative",
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
			parent_ids = {
				pid for pid in (
					person.mother_id,
					person.father_id,
					person.adoptive_mother_id,
					person.adoptive_father_id,
				)
				if pid
			}
			parents_by_person[person.id] = parent_ids
			for pid in parent_ids:
				children_by_parent[pid].add(person.id)

			for partner_id in (person.spouse_id, person.husband_id, person.wife_id):
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
			if token == "last_name":
				continue

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
		pairs = []
		normalized = {
			person.id: {
				"full_name": _normalize_text(f"{person.first_name} {person.last_name}"),
				"first_name": _normalize_text(person.first_name),
				"last_name": _normalize_text(person.last_name),
				"birth_place": _normalize_text(person.birth_place),
			}
			for person in people
		}

		for index, left in enumerate(people):
			left_data = normalized[left.id]
			for right in people[index + 1:]:
				right_data = normalized[right.id]

				name_score = _name_similarity(left_data["full_name"], right_data["full_name"])
				if name_score < 0.68:
					continue

				score = name_score
				if left.birth_date and right.birth_date:
					if left.birth_date == right.birth_date:
						score += 0.26
					elif left.birth_date.year == right.birth_date.year:
						score += 0.1
				if left_data["birth_place"] and left_data["birth_place"] == right_data["birth_place"]:
					score += 0.08

				if score < threshold:
					continue

				pairs.append(
					{
						"score": round(min(1.0, score), 3),
						"left": {
							"id": left.id,
							"name": str(left),
							"birth_date": left.birth_date.isoformat() if left.birth_date else None,
							"birth_place": left.birth_place,
						},
						"right": {
							"id": right.id,
							"name": str(right),
							"birth_date": right.birth_date.isoformat() if right.birth_date else None,
							"birth_place": right.birth_place,
						},
					}
				)

		pairs.sort(key=lambda item: item["score"], reverse=True)
		return pairs

	def _merge_person_into(self, primary, duplicate):
		fill_if_empty_fields = [
			"birth_date",
			"death_date",
			"birth_place",
			"death_place",
			"occupation",
			"mother",
			"father",
			"adoptive_mother",
			"adoptive_father",
			"spouse",
			"husband",
			"wife",
		]

		if not primary.last_name and duplicate.last_name:
			primary.last_name = duplicate.last_name
		if primary.gender == "O" and duplicate.gender in {"M", "F"}:
			primary.gender = duplicate.gender
		if not primary.photo and duplicate.photo:
			primary.photo = duplicate.photo

		for field_name in fill_if_empty_fields:
			if getattr(primary, field_name) is None and getattr(duplicate, field_name) is not None:
				setattr(primary, field_name, getattr(duplicate, field_name))
			elif getattr(primary, field_name) == "" and getattr(duplicate, field_name):
				setattr(primary, field_name, getattr(duplicate, field_name))

		if duplicate.biography:
			if not primary.biography:
				primary.biography = duplicate.biography
			elif duplicate.biography.strip() not in primary.biography:
				primary.biography = f"{primary.biography}\n\n{duplicate.biography}".strip()

		primary.save()

		for field_name in ["mother", "father", "adoptive_mother", "adoptive_father", "spouse", "husband", "wife"]:
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

		for field_name in ["mother", "father", "adoptive_mother", "adoptive_father", "spouse", "husband", "wife"]:
			if getattr(primary, f"{field_name}_id") == primary.id:
				setattr(primary, field_name, None)
		primary.save()

	def list(self, request, *args, **kwargs):
		people = list(
			Person.objects.select_related(
				"mother",
				"father",
				"adoptive_mother",
				"adoptive_father",
				"spouse",
				"husband",
				"wife",
			).all()
		)
		relationships = list(Relationship.objects.select_related("person1", "person2").all())
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
			limit = max(1, min(int(limit_raw), 1000))

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

		if limit is not None:
			data = data[:limit]

		return Response(data)

	@action(detail=False, methods=["get"])
	def duplicates(self, request):
		threshold_raw = request.query_params.get("threshold")
		try:
			threshold = float(threshold_raw) if threshold_raw is not None else 0.82
		except ValueError:
			threshold = 0.82
		threshold = max(0.6, min(threshold, 0.98))

		people = list(Person.objects.all().order_by("last_name", "first_name", "id"))
		pairs = self._detect_duplicate_pairs(people, threshold)

		groups_by_key = defaultdict(list)
		for pair in pairs:
			left = pair["left"]
			right = pair["right"]
			key = tuple(sorted([left["id"], right["id"]]))
			groups_by_key[key].append(pair)

		grouped_pairs = []
		for key, items in groups_by_key.items():
			best = max(items, key=lambda item: item["score"])
			grouped_pairs.append(best)

		grouped_pairs.sort(key=lambda item: item["score"], reverse=True)
		return Response({"threshold": threshold, "pairs": grouped_pairs})

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

		merged_ids = []
		with transaction.atomic():
			for duplicate_id in parsed_duplicate_ids:
				duplicate = people_map[duplicate_id]
				self._merge_person_into(primary, duplicate)
				merged_ids.append(duplicate_id)
			primary.refresh_from_db()

		serializer = self.get_serializer(primary, context={"request": request})
		return Response({
			"status": "ok",
			"primary_id": primary.id,
			"merged_ids": merged_ids,
			"person": serializer.data,
		})

	@action(detail=False, methods=["get"])
	def birthdays(self, request):
		today = timezone.localdate()
		queryset = Person.objects.filter(birth_date__month=today.month, birth_date__day=today.day)
		serializer = self.get_serializer(queryset, many=True, context={"request": request})
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

	ages = []
	current_year = timezone.localdate().year
	for person in people:
		if not person.birth_date:
			continue
		end_year = person.death_date.year if person.death_date else current_year
		age = end_year - person.birth_date.year
		if age >= 0:
			ages.append(age)

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
	people = list(Person.objects.all().order_by("id"))
	lines = [
		"0 HEAD",
		"1 SOUR FamilyTreeApp",
		"1 CHAR UTF-8",
	]

	person_to_gedcom_id = {}
	for index, person in enumerate(people, start=1):
		person_to_gedcom_id[person.id] = f"@I{index}@"

	for person in people:
		individual_id = person_to_gedcom_id[person.id]
		lines.append(f"0 {individual_id} INDI")
		lines.append(f"1 NAME {person.first_name} /{person.last_name}/")
		if person.gender == "M":
			lines.append("1 SEX M")
		elif person.gender == "F":
			lines.append("1 SEX F")
		else:
			lines.append("1 SEX U")

		if person.birth_date:
			lines.append("1 BIRT")
			lines.append(f"2 DATE {person.birth_date.isoformat()}")
		if person.death_date:
			lines.append("1 DEAT")
			lines.append(f"2 DATE {person.death_date.isoformat()}")

	lines.append("0 TRLR")
	content = "\n".join(lines) + "\n"

	response = HttpResponse(content, content_type="text/plain; charset=utf-8")
	response["Content-Disposition"] = "attachment; filename=family_tree.ged"
	return response


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def import_gedcom(request):
	uploaded_file = request.FILES.get("gedcom")
	if not uploaded_file:
		return Response({"error": "gedcom file is required"}, status=status.HTTP_400_BAD_REQUEST)

	try:
		raw = uploaded_file.read().decode("utf-8", errors="replace").splitlines()
	except Exception:
		return Response({"error": "Invalid GEDCOM file"}, status=status.HTTP_400_BAD_REQUEST)

	entries = []
	current = None

	for line in raw:
		parts = line.strip().split(" ", 2)
		if len(parts) < 2:
			continue
		level = parts[0]
		if level == "0" and len(parts) >= 3 and parts[2] == "INDI":
			if current:
				entries.append(current)
			current = {"first_name": "", "last_name": "", "gender": "O", "birth_date": None, "death_date": None}
			continue
		if not current:
			continue

		tag = parts[1]
		value = parts[2] if len(parts) > 2 else ""
		if tag == "NAME":
			match = re.match(r"^(.*?)\s*/(.*?)/$", value.strip())
			if match:
				current["first_name"] = match.group(1).strip()
				current["last_name"] = match.group(2).strip()
			else:
				current["first_name"] = value.strip()
		elif tag == "SEX":
			if value == "M":
				current["gender"] = "M"
			elif value == "F":
				current["gender"] = "F"
			else:
				current["gender"] = "O"
		elif tag == "DATE" and len(parts) > 2:
			try:
				parsed = date.fromisoformat(value.strip())
			except ValueError:
				continue
			if current.get("_last_event") == "BIRT":
				current["birth_date"] = parsed
			elif current.get("_last_event") == "DEAT":
				current["death_date"] = parsed
		elif tag in {"BIRT", "DEAT"}:
			current["_last_event"] = tag

	if current:
		entries.append(current)

	if not entries:
		return Response({"error": "No people found in GEDCOM file"}, status=status.HTTP_400_BAD_REQUEST)

	created = 0
	for entry in entries:
		if not entry.get("first_name"):
			continue
		Person.objects.create(
			first_name=entry.get("first_name", ""),
			last_name=entry.get("last_name", ""),
			gender=entry.get("gender", "O"),
			birth_date=entry.get("birth_date"),
			death_date=entry.get("death_date"),
		)
		created += 1

	return Response({"status": "ok", "created": created})


@csrf_exempt
def export_tree(request):
	if request.method != "GET":
		return JsonResponse({"error": "Method not allowed"}, status=405)

	db_file = _db_path()
	media_root = Path(settings.MEDIA_ROOT)

	if not db_file.exists():
		return JsonResponse({"error": "Database file was not found"}, status=500)

	buffer = io.BytesIO()
	with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
		archive.write(db_file, arcname="db.sqlite3")
		if media_root.exists():
			for root, _, files in os.walk(media_root):
				for file_name in files:
					abs_path = Path(root) / file_name
					rel_path = abs_path.relative_to(media_root)
					archive.write(abs_path, arcname=str(Path("media") / rel_path))

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

	temp_dir = Path(tempfile.mkdtemp(prefix="familytree_import_"))
	try:
		with zipfile.ZipFile(backup) as archive:
			_safe_extract_zip(archive, temp_dir)

		imported_db = temp_dir / "db.sqlite3"
		if not imported_db.exists():
			return JsonResponse({"error": "Backup does not contain db.sqlite3"}, status=400)

		destination_db = _db_path()
		destination_db.parent.mkdir(parents=True, exist_ok=True)

		connection.close()
		shutil.copy2(imported_db, destination_db)

		imported_media = temp_dir / "media"
		destination_media = Path(settings.MEDIA_ROOT)
		destination_media.parent.mkdir(parents=True, exist_ok=True)
		if imported_media.exists():
			if destination_media.exists():
				shutil.rmtree(destination_media)
			shutil.copytree(imported_media, destination_media)

		return JsonResponse({"status": "ok", "message": "Tree imported successfully"})
	except zipfile.BadZipFile:
		return JsonResponse({"error": "Invalid zip file"}, status=400)
	except Exception as exc:
		return JsonResponse({"error": str(exc)}, status=500)
	finally:
		shutil.rmtree(temp_dir, ignore_errors=True)


def dashboard(request):
	return render(request, "familyTree/dashboard.html")
