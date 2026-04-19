from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('familyTree', '0006_person_adoptive_father_person_adoptive_mother_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['last_name', 'first_name'], name='familyTree_p_last_na_7358dc_idx'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['birth_date'], name='familyTree_p_birth_d_8f4ccf_idx'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['death_date'], name='familyTree_p_death_d_6d596f_idx'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['birth_place'], name='familyTree_p_birth_p_49464e_idx'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['death_place'], name='familyTree_p_death_p_19f7a6_idx'),
        ),
        migrations.AddConstraint(
            model_name='relationship',
            constraint=models.CheckConstraint(
                condition=models.Q(('person1', models.F('person2')), _negated=True),
                name='relationship_persons_must_differ',
            ),
        ),
        migrations.AddIndex(
            model_name='relationship',
            index=models.Index(fields=['person1', 'person2'], name='familyTree_r_person1_19a7b2_idx'),
        ),
        migrations.AddIndex(
            model_name='relationship',
            index=models.Index(fields=['relationship_type', 'status'], name='familyTree_r_relatio_5531ca_idx'),
        ),
        migrations.AddIndex(
            model_name='relationship',
            index=models.Index(fields=['start_date'], name='familyTree_r_start_d_9159bc_idx'),
        ),
        migrations.AddIndex(
            model_name='relationship',
            index=models.Index(fields=['end_date'], name='familyTree_r_end_dat_98f89b_idx'),
        ),
    ]
