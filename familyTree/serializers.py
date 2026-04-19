from rest_framework import serializers
from .models import Person, PersonMedia, Relationship


class RelationshipSerializer(serializers.ModelSerializer):
    person1_name = serializers.SerializerMethodField()
    person2_name = serializers.SerializerMethodField()

    class Meta:
        model = Relationship
        fields = [
            'id', 'person1', 'person2', 'person1_name', 'person2_name',
            'relationship_type', 'status', 'start_date', 'end_date', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'person1_name', 'person2_name']

    def get_person1_name(self, obj):
        return str(obj.person1)

    def get_person2_name(self, obj):
        return str(obj.person2)

    def validate(self, attrs):
        person1 = attrs.get('person1', getattr(self.instance, 'person1', None))
        person2 = attrs.get('person2', getattr(self.instance, 'person2', None))
        if person1 and person2 and person1.id == person2.id:
            raise serializers.ValidationError('A person cannot have a relationship with themselves.')
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError('End date cannot be earlier than start date.')

        if person1 and person2:
            low_id, high_id = sorted([person1.id, person2.id])
            relationship_type = attrs.get('relationship_type', getattr(self.instance, 'relationship_type', 'MARRIAGE'))
            same_pair_qs = Relationship.objects.filter(
                person1_id=low_id,
                person2_id=high_id,
                relationship_type=relationship_type,
                start_date=start_date,
            )
            if self.instance:
                same_pair_qs = same_pair_qs.exclude(id=self.instance.id)
            if same_pair_qs.exists():
                raise serializers.ValidationError('This relationship record already exists for the selected pair and start date.')
        return attrs


class PersonMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = PersonMedia
        fields = ['id', 'person', 'file', 'file_url', 'media_type', 'caption', 'created_at']
        read_only_fields = ['file_url', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            url = obj.file.url
            return request.build_absolute_uri(url) if request else url
        return None

class PersonSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    spouse_name = serializers.SerializerMethodField()
    husband_name = serializers.SerializerMethodField()
    wife_name = serializers.SerializerMethodField()
    mother_name = serializers.SerializerMethodField()
    father_name = serializers.SerializerMethodField()
    adoptive_mother_name = serializers.SerializerMethodField()
    adoptive_father_name = serializers.SerializerMethodField()
    partners = serializers.SerializerMethodField()
    partner_relationships = serializers.SerializerMethodField()
    media_items = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            'id', 'first_name', 'last_name', 'gender', 'birth_date', 'death_date',
            'birth_place', 'death_place', 'occupation', 'biography',
            'photo', 'photo_url', 'mother', 'father', 'adoptive_mother', 'adoptive_father',
            'spouse', 'husband', 'wife', 'spouse_name', 'husband_name', 'wife_name',
            'mother_name', 'father_name', 'adoptive_mother_name', 'adoptive_father_name',
            'partners', 'partner_relationships', 'media_items',
        ]
        read_only_fields = [
            'photo_url', 'spouse_name', 'husband_name', 'wife_name', 'mother_name',
            'father_name', 'adoptive_mother_name', 'adoptive_father_name',
            'partners', 'partner_relationships', 'media_items',
        ]

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if obj.photo and hasattr(obj.photo, 'url'):
            url = obj.photo.url
            return request.build_absolute_uri(url) if request else url
        return None

    def _get_name(self, person):
        return f"{person.first_name} {person.last_name}".strip() if person else None

    def get_spouse_name(self, obj): return self._get_name(obj.spouse)
    def get_husband_name(self, obj): return self._get_name(obj.husband)
    def get_wife_name(self, obj): return self._get_name(obj.wife)
    def get_mother_name(self, obj): return self._get_name(obj.mother)
    def get_father_name(self, obj): return self._get_name(obj.father)
    def get_adoptive_mother_name(self, obj): return self._get_name(obj.adoptive_mother)
    def get_adoptive_father_name(self, obj): return self._get_name(obj.adoptive_father)

    def get_partners(self, obj):
        partner_ids = set()
        for legacy_id in (obj.spouse_id, obj.husband_id, obj.wife_id):
            if legacy_id:
                partner_ids.add(legacy_id)

        relationships = Relationship.objects.filter(person1=obj) | Relationship.objects.filter(person2=obj)
        for relationship in relationships:
            partner_id = relationship.person2_id if relationship.person1_id == obj.id else relationship.person1_id
            partner_ids.add(partner_id)

        return sorted(partner_ids)

    def get_partner_relationships(self, obj):
        relationships = (
            Relationship.objects.filter(person1=obj) |
            Relationship.objects.filter(person2=obj)
        ).select_related('person1', 'person2').order_by('-start_date', '-created_at')[:25]

        data = []
        for relationship in relationships:
            partner = relationship.person2 if relationship.person1_id == obj.id else relationship.person1
            data.append(
                {
                    'id': relationship.id,
                    'partner_id': partner.id,
                    'partner_name': str(partner),
                    'relationship_type': relationship.relationship_type,
                    'status': relationship.status,
                    'start_date': relationship.start_date.isoformat() if relationship.start_date else None,
                    'end_date': relationship.end_date.isoformat() if relationship.end_date else None,
                    'notes': relationship.notes,
                }
            )
        return data

    def get_media_items(self, obj):
        request = self.context.get('request')
        items = []
        for media in obj.media_items.all()[:20]:
            file_url = media.file.url if media.file and hasattr(media.file, 'url') else None
            items.append(
                {
                    'id': media.id,
                    'media_type': media.media_type,
                    'caption': media.caption,
                    'file_url': request.build_absolute_uri(file_url) if file_url and request else file_url,
                }
            )
        return items

    def validate(self, attrs):
        current_id = getattr(self.instance, 'id', None)
        mother = attrs.get('mother')
        father = attrs.get('father')
        adoptive_mother = attrs.get('adoptive_mother')
        adoptive_father = attrs.get('adoptive_father')

        if mother and mother.gender == 'M':
            raise serializers.ValidationError({'mother': 'Mother cannot be Male.'})
        if father and father.gender == 'F':
            raise serializers.ValidationError({'father': 'Father cannot be Female.'})
        if adoptive_mother and adoptive_mother.gender == 'M':
            raise serializers.ValidationError({'adoptive_mother': 'Adoptive mother cannot be Male.'})
        if adoptive_father and adoptive_father.gender == 'F':
            raise serializers.ValidationError({'adoptive_father': 'Adoptive father cannot be Female.'})
        if current_id and (mother and mother.id == current_id or father and father.id == current_id):
            raise serializers.ValidationError('A person cannot be their own parent.')
        if current_id and (adoptive_mother and adoptive_mother.id == current_id or adoptive_father and adoptive_father.id == current_id):
            raise serializers.ValidationError('A person cannot be their own adoptive parent.')
        return super().validate(attrs)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)