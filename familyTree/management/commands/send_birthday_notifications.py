from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from familyTree.models import Person
import datetime


class Command(BaseCommand):
    help = 'Send birthday notifications for people with birthdays today'

    def handle(self, *args, **options):
        today = timezone.localdate()
        qs = Person.objects.filter(birth_date__month=today.month, birth_date__day=today.day)
        if not qs.exists():
            self.stdout.write('No birthdays today.')
            return

        for p in qs:
            name = str(p)
            msg = f"Birthday: {name} ({p.birth_date})"
            # If email settings exist we could send an email here; for now just print/log
            self.stdout.write(msg)
