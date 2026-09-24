"""Data migration which creates a sample survey with ten questions."""

from django.db import migrations

SURVEY_TITLE = 'InvenTree User Feedback Survey'

SURVEY_DESCRIPTION = (
    'A short sample survey, covering a range of different question types.'
)

QUESTIONS = [
    {
        'text': 'How satisfied are you with InvenTree overall?',
        'question_type': 'rating',
        'required': True,
    },
    {
        'text': 'Would you recommend InvenTree to a colleague?',
        'question_type': 'boolean',
        'required': True,
    },
    {
        'text': 'How often do you use InvenTree?',
        'question_type': 'single_choice',
        'required': True,
        'choices': ['Daily', 'Weekly', 'Monthly', 'Rarely'],
    },
    {
        'text': 'Which features do you use most?',
        'question_type': 'multiple_choice',
        'required': False,
        'choices': [
            'Parts',
            'Stock',
            'Purchase Orders',
            'Sales Orders',
            'Build Orders',
            'Reporting',
        ],
    },
    {
        'text': 'What is your primary role?',
        'question_type': 'single_choice',
        'required': True,
        'choices': [
            'Engineering',
            'Manufacturing',
            'Purchasing',
            'Management',
            'Other',
        ],
    },
    {
        'text': 'How would you rate the documentation?',
        'question_type': 'rating',
        'required': False,
    },
    {
        'text': 'Do you use the mobile app?',
        'question_type': 'boolean',
        'required': False,
    },
    {
        'text': 'Which integrations are important to you?',
        'question_type': 'multiple_choice',
        'required': False,
        'choices': ['Barcode scanners', 'Label printers', 'ERP systems', 'Webhooks'],
    },
    {
        'text': 'Which feature would you like to see improved?',
        'question_type': 'text',
        'required': False,
    },
    {
        'text': 'Any other comments or suggestions?',
        'question_type': 'text',
        'required': False,
    },
]


def create_sample_survey(apps, schema_editor):
    """Create a sample survey, with ten questions of mixed type."""
    Survey = apps.get_model('survey', 'Survey')
    Question = apps.get_model('survey', 'Question')
    Choice = apps.get_model('survey', 'Choice')

    if Survey.objects.filter(title=SURVEY_TITLE).exists():
        return

    survey = Survey.objects.create(
        title=SURVEY_TITLE, description=SURVEY_DESCRIPTION, active=True
    )

    for idx, data in enumerate(QUESTIONS):
        question = Question.objects.create(
            survey=survey,
            text=data['text'],
            question_type=data['question_type'],
            order=idx + 1,
            required=data['required'],
        )

        for choice_idx, text in enumerate(data.get('choices', [])):
            Choice.objects.create(question=question, text=text, order=choice_idx + 1)


def delete_sample_survey(apps, schema_editor):
    """Remove the sample survey again."""
    Survey = apps.get_model('survey', 'Survey')

    Survey.objects.filter(title=SURVEY_TITLE).delete()


class Migration(migrations.Migration):
    """Create the sample survey data."""

    dependencies = [('survey', '0001_initial')]

    operations = [
        migrations.RunPython(create_sample_survey, reverse_code=delete_sample_survey)
    ]
