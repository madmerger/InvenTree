"""Django admin interface for the survey app."""

from django.contrib import admin

from survey import models


class ChoiceInline(admin.TabularInline):
    """Inline admin class for Choice."""

    model = models.Choice


class QuestionInline(admin.TabularInline):
    """Inline admin class for Question."""

    model = models.Question


@admin.register(models.Survey)
class SurveyAdmin(admin.ModelAdmin):
    """Admin class for Survey."""

    list_display = ['title', 'active', 'created']
    list_filter = ['active']
    search_fields = ['title', 'description']
    inlines = [QuestionInline]


@admin.register(models.Question)
class QuestionAdmin(admin.ModelAdmin):
    """Admin class for Question."""

    list_display = ['text', 'survey', 'question_type', 'order', 'required']
    list_filter = ['survey', 'question_type', 'required']
    search_fields = ['text']
    inlines = [ChoiceInline]


class AnswerInline(admin.TabularInline):
    """Inline admin class for Answer."""

    model = models.Answer


@admin.register(models.SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    """Admin class for SurveyResponse."""

    list_display = ['survey', 'user', 'submitted']
    list_filter = ['survey']
    inlines = [AnswerInline]
