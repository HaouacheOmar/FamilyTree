import io
import zipfile
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from . import gedcom
from .models import Person, Relationship


class PersonApiEnhancementTests(TestCase):
	def setUp(self):
		self.client = APIClient()

		self.grandfather = Person.objects.create(first_name='John', last_name='Root', gender='M', birth_date=date(1940, 1, 1))
		self.grandmother = Person.objects.create(first_name='Mary', last_name='Root', gender='F', birth_date=date(1942, 2, 1))
		self.father = Person.objects.create(
			first_name='Adam',
			last_name='Root',
			gender='M',
			birth_date=date(1965, 5, 20),
			birth_place='Algiers',
			father=self.grandfather,
			mother=self.grandmother,
		)
		self.mother = Person.objects.create(first_name='Eve', last_name='Stone', gender='F', birth_date=date(1967, 6, 10), birth_place='Oran')
		self.child = Person.objects.create(
			first_name='Lina',
			last_name='Root',
			gender='F',
			birth_date=date(1990, 7, 1),
			birth_place='Algiers',
			father=self.father,
			mother=self.mother,
		)
		self.deceased_uncle = Person.objects.create(
			first_name='Sam',
			last_name='Root',
			gender='M',
			birth_date=date(1960, 9, 1),
			death_date=date(2018, 1, 1),
			birth_place='Constantine',
		)

		Relationship.objects.create(
			person1=self.father,
			person2=self.mother,
			relationship_type='MARRIAGE',
			status='ACTIVE',
			start_date=date(1988, 1, 1),
		)

	def test_people_list_supports_advanced_filters(self):
		response = self.client.get('/api/people/', {
			'living': 'living',
			'birth_from': '1960-01-01',
			'birth_to': '1999-12-31',
			'location': 'algiers',
		})

		self.assertEqual(response.status_code, 200)
		returned_ids = {row['id'] for row in response.json()}
		self.assertIn(self.father.id, returned_ids)
		self.assertIn(self.child.id, returned_ids)
		self.assertNotIn(self.deceased_uncle.id, returned_ids)

	def test_people_list_supports_branch_filter(self):
		outsider = Person.objects.create(first_name='Outside', last_name='Family', gender='O', birth_date=date(1985, 1, 1))

		response = self.client.get('/api/people/', {
			'branch_root': str(self.father.id),
		})

		self.assertEqual(response.status_code, 200)
		returned_ids = {row['id'] for row in response.json()}
		self.assertIn(self.child.id, returned_ids)
		self.assertIn(self.mother.id, returned_ids)
		self.assertNotIn(outsider.id, returned_ids)

	def test_duplicate_detection_and_merge(self):
		duplicate = Person.objects.create(
			first_name='Lena',
			last_name='Root',
			gender='F',
			birth_date=date(1990, 7, 1),
			birth_place='Algiers',
		)

		duplicates_response = self.client.get('/api/people/duplicates/', {
			'threshold': '0.70',
		})
		self.assertEqual(duplicates_response.status_code, 200)
		pair_ids = {
			tuple(sorted([pair['left']['id'], pair['right']['id']]))
			for pair in duplicates_response.json()['pairs']
		}
		self.assertIn(tuple(sorted([self.child.id, duplicate.id])), pair_ids)

		merge_response = self.client.post('/api/people/merge/', {
			'primary_id': self.child.id,
			'duplicate_ids': [duplicate.id],
		}, format='json')
		self.assertEqual(merge_response.status_code, 200)

		self.assertFalse(Person.objects.filter(id=duplicate.id).exists())
		self.assertTrue(Person.objects.filter(id=self.child.id).exists())

	def test_arabic_relation_search(self):
		response = self.client.get('/api/people/', {'q': 'جدة'})

		self.assertEqual({row['id'] for row in response.json()}, {self.grandmother.id})

	def test_list_reports_total_before_limit(self):
		response = self.client.get('/api/people/', {'limit': '2'})

		self.assertEqual(len(response.json()), 2)
		self.assertEqual(response['X-Total-Count'], str(Person.objects.count()))

	def test_merge_when_primary_points_at_duplicate(self):
		duplicate = Person.objects.create(first_name='Lina', last_name='Root', gender='F', spouse=self.child)
		self.child.spouse = duplicate
		self.child.save()

		response = self.client.post('/api/people/merge/', {'primary_id': self.child.id, 'duplicate_ids': [duplicate.id]}, format='json')

		self.assertEqual(response.status_code, 200)
		self.child.refresh_from_db()
		self.assertIsNone(self.child.spouse_id)
		self.assertEqual(self.child.father_id, self.father.id)

	def test_stats_age_respects_birthday_not_yet_reached(self):
		Person.objects.all().delete()
		today = date.today()
		Person.objects.create(first_name='A', birth_date=date(today.year - 30, 12, 31), death_date=date(today.year, 12, 30))

		self.assertEqual(self.client.get('/api/stats/').json()['oldest_age'], 29)


class GedcomTests(TestCase):
	def test_round_trip_keeps_families_dates_and_places(self):
		dad = Person.objects.create(first_name='Adam', last_name='Root', gender='M', birth_date=date(1960, 3, 4), birth_place='Algiers')
		mom = Person.objects.create(first_name='Eve', last_name='Stone', gender='F')
		Person.objects.create(first_name='Lina', last_name='Root', gender='F', father=dad, mother=mom)
		Relationship.objects.create(person1=dad, person2=mom)

		text = gedcom.export_gedcom(list(Person.objects.order_by('id')), list(Relationship.objects.all()))
		self.assertIn('2 DATE 4 MAR 1960', text)
		Person.objects.all().delete()

		self.assertEqual(gedcom.import_gedcom(text), 3)
		child = Person.objects.get(first_name='Lina')
		self.assertEqual(child.father.first_name, 'Adam')
		self.assertEqual(child.mother.first_name, 'Eve')
		self.assertEqual(child.father.birth_date, date(1960, 3, 4))
		self.assertEqual(child.father.birth_place, 'Algiers')
		self.assertTrue(Relationship.objects.filter(person1=child.father, person2=child.mother).exists())

	def test_later_records_do_not_overwrite_last_person(self):
		text = '\n'.join([
			'0 HEAD',
			'0 @I1@ INDI', '1 NAME John /Smith/ Jr', '1 BIRT', '2 DATE 1 JAN 1900', '1 BURI', '2 DATE 5 MAY 1990',
			'0 @F1@ FAM', '1 HUSB @I1@', '1 MARR', '2 DATE 2 FEB 1925',
			'0 @U1@ SUBM', '1 NAME Submitter',
			'0 TRLR',
		])
		gedcom.import_gedcom(text)

		person = Person.objects.get()
		self.assertEqual((person.first_name, person.last_name), ('John', 'Smith'))
		self.assertEqual(person.birth_date, date(1900, 1, 1))
		self.assertIsNone(person.death_date)


class BirthdayTests(TestCase):
	def test_leap_day_birthdays_show_on_feb_28_and_skip_deceased(self):
		leap = Person.objects.create(first_name='Leap', birth_date=date(2000, 2, 29))
		Person.objects.create(first_name='Gone', birth_date=date(1950, 2, 28), death_date=date(2000, 1, 1))

		self.assertEqual(list(Person.birthdays_on(date(2026, 2, 28))), [leap])
		self.assertEqual(list(Person.birthdays_on(date(2028, 2, 28))), [])


@override_settings(API_TOKEN='secret')
class ApiTokenTests(TestCase):
	def test_api_requires_token_when_configured(self):
		client = APIClient()
		self.assertEqual(client.get('/api/people/').status_code, 403)
		self.assertEqual(client.get('/api/people/', HTTP_X_FAMILYTREE_TOKEN='secret').status_code, 200)


class BackupTests(TransactionTestCase):
	def test_export_then_import_restores_data(self):
		client = APIClient()
		Person.objects.create(first_name='Kept')
		backup = client.get('/api/export/').content
		Person.objects.create(first_name='Added later')

		response = client.post('/api/import/', {'backup': SimpleUploadedFile('b.zip', backup)})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(list(Person.objects.values_list('first_name', flat=True)), ['Kept'])

	def _backup_with_only_sqlite(self):
		# An older backup: the raw database file, no data.json.
		backup = APIClient().get('/api/export/').content
		buffer = io.BytesIO()
		with zipfile.ZipFile(io.BytesIO(backup)) as source, zipfile.ZipFile(buffer, 'w') as target:
			for name in source.namelist():
				if name != 'data.json':
					target.writestr(name, source.read(name))
		return buffer.getvalue()

	def test_import_of_sqlite_only_backup(self):
		Person.objects.create(first_name='Kept')
		backup = self._backup_with_only_sqlite()
		Person.objects.create(first_name='Added later')

		response = APIClient().post('/api/import/', {'backup': SimpleUploadedFile('b.zip', backup)})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(list(Person.objects.values_list('first_name', flat=True)), ['Kept'])

	def test_sqlite_backup_converts_to_fixture(self):
		# The path a Postgres-hosted install uses for older SQLite-only backups.
		from pathlib import Path
		from unittest import mock
		import tempfile
		from .views import _replace_family_data, _sqlite_backup_to_fixture
		dad = Person.objects.create(first_name='Dad', gender='M')
		Person.objects.create(first_name='Kid', father=dad)
		backup = self._backup_with_only_sqlite()
		Person.objects.all().delete()

		# The converter opens a temporary second connection; let this test use it.
		allowed = mock.patch.object(type(self), 'databases', {*self.databases, 'familytree_import'})
		with allowed, tempfile.TemporaryDirectory() as temp_dir:
			with zipfile.ZipFile(io.BytesIO(backup)) as archive:
				archive.extract('db.sqlite3', temp_dir)
			fixture = Path(temp_dir) / 'data.json'
			_sqlite_backup_to_fixture(Path(temp_dir) / 'db.sqlite3', fixture)
			_replace_family_data(fixture)

		self.assertEqual(Person.objects.get(first_name='Kid').father.first_name, 'Dad')

	def test_import_rejects_non_database(self):
		buffer = io.BytesIO()
		with zipfile.ZipFile(buffer, 'w') as archive:
			archive.writestr('db.sqlite3', 'not a database')
		Person.objects.create(first_name='Safe')

		response = APIClient().post('/api/import/', {'backup': SimpleUploadedFile('b.zip', buffer.getvalue())})

		self.assertEqual(response.status_code, 400)
		self.assertTrue(Person.objects.filter(first_name='Safe').exists())
