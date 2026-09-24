"""Survey API tests."""

from django.urls import reverse

from InvenTree.unit_test import InvenTreeAPITestCase
from survey.models import Answer, Choice, Question, Survey, SurveyResponse


class SurveyAPITest(InvenTreeAPITestCase):
    """Class for unit testing survey API endpoints."""

    def setUp(self):
        """Create a simple survey for testing."""
        super().setUp()

        self.survey = Survey.objects.create(
            title='Test Survey', description='A survey for testing'
        )

        self.text_question = Question.objects.create(
            survey=self.survey,
            text='What do you think?',
            question_type=Question.QuestionType.TEXT,
            order=1,
        )

        self.choice_question = Question.objects.create(
            survey=self.survey,
            text='Which one?',
            question_type=Question.QuestionType.SINGLE_CHOICE,
            order=2,
        )

        self.choice = Choice.objects.create(
            question=self.choice_question, text='Option A', order=1
        )

    def test_survey_list(self):
        """Test the survey list API endpoint."""
        response = self.get(reverse('api-survey-list'), {'search': 'Test Survey'})

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Test Survey')
        self.assertEqual(len(response.data[0]['questions']), 2)

    def test_sample_survey(self):
        """Test that the sample survey (created by data migration) has 10 questions."""
        sample = Survey.objects.get(title='InvenTree User Feedback Survey')

        response = self.get(reverse('api-survey-detail', kwargs={'pk': sample.pk}))

        self.assertEqual(len(response.data['questions']), 10)

    def test_survey_detail(self):
        """Test the survey detail API endpoint (including nested data)."""
        response = self.get(reverse('api-survey-detail', kwargs={'pk': self.survey.pk}))

        questions = response.data['questions']

        self.assertEqual(len(questions), 2)
        self.assertEqual(questions[0]['question_type'], 'text')
        self.assertEqual(questions[1]['question_type'], 'single_choice')
        self.assertEqual(questions[1]['choices'][0]['text'], 'Option A')

    def test_submit_response(self):
        """Test that a survey response can be submitted."""
        data = {
            'survey': self.survey.pk,
            'answers': [
                {'question': self.text_question.pk, 'value': 'Looks good'},
                {'question': self.choice_question.pk, 'value': str(self.choice.pk)},
            ],
        }

        response = self.post(reverse('api-survey-response-list'), data)

        self.assertEqual(SurveyResponse.objects.count(), 1)
        self.assertEqual(Answer.objects.count(), 2)

        survey_response = SurveyResponse.objects.first()

        self.assertEqual(survey_response.user, self.user)
        self.assertEqual(response.data['survey'], self.survey.pk)

        answer = survey_response.answers.get(question=self.text_question)
        self.assertEqual(answer.value, 'Looks good')

    def test_submit_response_invalid_question(self):
        """Test that answers must refer to questions of the given survey."""
        other_survey = Survey.objects.create(title='Other Survey')

        other_question = Question.objects.create(
            survey=other_survey, text='Unrelated?', order=1
        )

        data = {
            'survey': self.survey.pk,
            'answers': [{'question': other_question.pk, 'value': 'nope'}],
        }

        self.post(reverse('api-survey-response-list'), data, expected_code=400)

        self.assertEqual(SurveyResponse.objects.count(), 0)

    def test_response_list(self):
        """Test the survey response list API endpoint."""
        survey_response = SurveyResponse.objects.create(
            survey=self.survey, user=self.user
        )

        Answer.objects.create(
            response=survey_response, question=self.text_question, value='Nice'
        )

        response = self.get(reverse('api-survey-response-list'))

        self.assertEqual(len(response.data), 1)
        self.assertEqual(len(response.data[0]['answers']), 1)
        self.assertEqual(response.data[0]['answers'][0]['value'], 'Nice')
