from django.db import models

class Person(models.Model):
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)

    GENDER_CHOICES = (
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    )
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='O')
    birth_date = models.DateField(null=True, blank=True)
    death_date = models.DateField(null=True, blank=True) # <-- NEW FIELD
    birth_place = models.CharField(max_length=250, null=True, blank=True)
    death_place = models.CharField(max_length=250, null=True, blank=True)
    occupation = models.CharField(max_length=150, null=True, blank=True)
    biography = models.TextField(null=True, blank=True)
    photo = models.ImageField(upload_to='photos/', null=True, blank=True)

    mother = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children_mother'
    )
    father = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children_father'
    )
    spouse = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='spouse_links'
    )
    husband = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='husband_links'
    )
    wife = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='wife_links'
    )
    adoptive_mother = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='adopted_children_mother'
    )
    adoptive_father = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='adopted_children_father'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['last_name', 'first_name']),
            models.Index(fields=['birth_date']),
            models.Index(fields=['death_date']),
            models.Index(fields=['birth_place']),
            models.Index(fields=['death_place']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()

    def parents(self):
        return [p for p in (self.mother, self.father) if p]


class Relationship(models.Model):
    RELATIONSHIP_TYPE_CHOICES = (
        ('MARRIAGE', 'Marriage'),
        ('PARTNER', 'Partner'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('DIVORCED', 'Divorced'),
        ('SEPARATED', 'Separated'),
        ('WIDOWED', 'Widowed'),
        ('ENDED', 'Ended'),
    )

    person1 = models.ForeignKey(Person, on_delete=models.CASCADE, related_name='relationships_as_person1')
    person2 = models.ForeignKey(Person, on_delete=models.CASCADE, related_name='relationships_as_person2')
    relationship_type = models.CharField(max_length=16, choices=RELATIONSHIP_TYPE_CHOICES, default='MARRIAGE')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='ACTIVE')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date', '-created_at']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(person1=models.F('person2')),
                name='relationship_persons_must_differ',
            ),
        ]
        indexes = [
            models.Index(fields=['person1', 'person2']),
            models.Index(fields=['relationship_type', 'status']),
            models.Index(fields=['start_date']),
            models.Index(fields=['end_date']),
        ]

    def save(self, *args, **kwargs):
        # Keep pair ordering stable to avoid mirrored duplicates.
        if self.person1_id and self.person2_id and self.person1_id > self.person2_id:
            self.person1_id, self.person2_id = self.person2_id, self.person1_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.person1} - {self.person2} ({self.relationship_type})"


class PersonMedia(models.Model):
    MEDIA_TYPE_CHOICES = (
        ('PHOTO', 'Photo'),
        ('DOCUMENT', 'Document'),
    )

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name='media_items')
    file = models.FileField(upload_to='person_media/')
    media_type = models.CharField(max_length=16, choices=MEDIA_TYPE_CHOICES, default='PHOTO')
    caption = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.person} - {self.media_type}"