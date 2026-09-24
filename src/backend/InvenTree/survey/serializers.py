"""Serializers for the survey app."""

from django.db import transaction

from rest_framework import serializers

from survey.models import Answer, Choice, Question, Survey, SurveyResponse


class ChoiceSerializer(serializers.ModelSerializer):
    """Serializer for a Choice."""

    class Meta:
        """Meta for serializer."""

        model = Choice
        fields = ['pk', 'text', 'order']
        read_only_fields = fields


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for a Question, including the available choices."""

    class Meta:
        """Meta for serializer."""

        model = Question
        fields = ['pk', 'text', 'question_type', 'order', 'required', 'choices']
        read_only_fields = fields

    choices = ChoiceSerializer(many=True, read_only=True)


class SurveySerializer(serializers.ModelSerializer):
    """Serializer for a Survey, including the nested questions and choices."""

    class Meta:
        """Meta for serializer."""

        model = Survey
        fields = ['pk', 'title', 'description', 'active', 'created', 'questions']
        read_only_fields = ['created', 'questions']

    questions = QuestionSerializer(many=True, read_only=True)


class AnswerSerializer(serializers.ModelSerializer):
    """Serializer for a single Answer."""

    class Meta:
        """Meta for serializer."""

        model = Answer
        fields = ['pk', 'question', 'value']
        read_only_fields = ['pk']


class SurveyResponseSerializer(serializers.ModelSerializer):
    """Serializer for a SurveyResponse, with nested answers."""

    class Meta:
        """Meta for serializer."""

        model = SurveyResponse
        fields = ['pk', 'survey', 'submitted', 'user', 'answers']
        read_only_fields = ['submitted', 'user']

    answers = AnswerSerializer(many=True)

    def validate(self, attrs):
        """Ensure that each answer refers to a question of the given survey."""
        data = super().validate(attrs)

        survey = data.get('survey')
        questions = {question.pk for question in survey.questions.all()}

        for answer in data.get('answers', []):
            if answer['question'].pk not in questions:
                raise serializers.ValidationError({
                    'answers': 'Answer does not match a question of this survey'
                })

        return data

    @transaction.atomic
    def create(self, validated_data):
        """Create the SurveyResponse and all associated Answer objects."""
        answers = validated_data.pop('answers', [])

        request = self.context.get('request')

        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user

        response = SurveyResponse.objects.create(**validated_data)

        Answer.objects.bulk_create([
            Answer(response=response, **answer) for answer in answers
        ])

        return response
