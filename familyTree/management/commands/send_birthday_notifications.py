from datetime import date

from django.core.management.base import BaseCommand

from familyTree.models import Person


class Command(BaseCommand):
    help = 'List living people whose birthday is today'

    def handle(self, *args, **options):
        people = Person.birthdays_on(date.today())
        if not people:
            self.stdout.write('No birthdays today.')
        for person in people:
            self.stdout.write(f"Birthday: {person} ({person.birth_date})")
