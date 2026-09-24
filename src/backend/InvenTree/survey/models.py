"""Models for the survey app."""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Survey(models.Model):
    """A Survey is a collection of questions which can be answered by a user."""

    class Meta:
        """Meta options for the Survey model."""

        verbose_name = _('Survey')
        verbose_name_plural = _('Surveys')

    title = models.CharField(
        max_length=250, verbose_name=_('Title'), help_text=_('Title of the survey')
    )

    description = models.TextField(
        blank=True,
        verbose_name=_('Description'),
        help_text=_('Description of the survey'),
    )

    active = models.BooleanField(
        default=True, verbose_name=_('Active'), help_text=_('Surveys can be disabled')
    )

    created = models.DateTimeField(auto_now_add=True, verbose_name=_('Created'))

    def __str__(self) -> str:
        """String representation of a survey."""
        return self.title


class Question(models.Model):
    """A single question which belongs to a Survey."""

    class QuestionType(models.TextChoices):
        """Supported question types."""

        TEXT = 'text', _('Text')
        SINGLE_CHOICE = 'single_choice', _('Single Choice')
        MULTIPLE_CHOICE = 'multiple_choice', _('Multiple Choice')
        RATING = 'rating', _('Rating')
        BOOLEAN = 'boolean', _('Boolean')

    class Meta:
        """Meta options for the Question model."""

        verbose_name = _('Question')
        verbose_name_plural = _('Questions')
        ordering = ['order', 'pk']

    survey = models.ForeignKey(
        Survey,
        on_delete=models.CASCADE,
        related_name='questions',
        verbose_name=_('Survey'),
    )

    text = models.CharField(
        max_length=250, verbose_name=_('Text'), help_text=_('Question text')
    )

    question_type = models.CharField(
        max_length=25,
        choices=QuestionType.choices,
        default=QuestionType.TEXT,
        verbose_name=_('Question Type'),
        help_text=_('Type of the question'),
    )

    order = models.PositiveIntegerField(
        default=0, verbose_name=_('Order'), help_text=_('Display order')
    )

    required = models.BooleanField(
        default=True,
        verbose_name=_('Required'),
        help_text=_('Question must be answered'),
    )

    def __str__(self) -> str:
        """String representation of a question."""
        return self.text


class Choice(models.Model):
    """A selectable choice, belonging to a choice-type Question."""

    class Meta:
        """Meta options for the Choice model."""

        verbose_name = _('Choice')
        verbose_name_plural = _('Choices')
        ordering = ['order', 'pk']

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='choices',
        verbose_name=_('Question'),
    )

    text = models.CharField(
        max_length=250, verbose_name=_('Text'), help_text=_('Choice text')
    )

    order = models.PositiveIntegerField(
        default=0, verbose_name=_('Order'), help_text=_('Display order')
    )

    def __str__(self) -> str:
        """String representation of a choice."""
        return self.text


class SurveyResponse(models.Model):
    """A single submission of answers for a Survey."""

    class Meta:
        """Meta options for the SurveyResponse model."""

        verbose_name = _('Survey Response')
        verbose_name_plural = _('Survey Responses')

    survey = models.ForeignKey(
        Survey,
        on_delete=models.CASCADE,
        related_name='responses',
        verbose_name=_('Survey'),
    )

    submitted = models.DateTimeField(auto_now_add=True, verbose_name=_('Submitted'))

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='survey_responses',
        verbose_name=_('User'),
    )

    def __str__(self) -> str:
        """String representation of a survey response."""
        return f'{self.survey} - {self.submitted}'


class Answer(models.Model):
    """The answer provided for a single Question within a SurveyResponse."""

    class Meta:
        """Meta options for the Answer model."""

        verbose_name = _('Answer')
        verbose_name_plural = _('Answers')

    response = models.ForeignKey(
        SurveyResponse,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name=_('Response'),
    )

    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name=_('Question'),
    )

    value = models.TextField(
        blank=True,
        verbose_name=_('Value'),
        help_text=_('Answer value - free text, or selected choice ID(s)'),
    )

    def __str__(self) -> str:
        """String representation of an answer."""
        return f'{self.question}: {self.value}'
