from django.contrib import admin

from .models import Person, PersonMedia, Relationship

admin.site.register([Person, Relationship, PersonMedia])

