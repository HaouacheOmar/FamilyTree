from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

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
