"""JSON API for the survey app."""

from django.urls import path

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions

import survey.serializers as SurveySerializers
from InvenTree.filters import SEARCH_ORDER_FILTER
from InvenTree.mixins import ListCreateAPI, RetrieveUpdateDestroyAPI
from InvenTree.permissions import RolePermission
from survey.models import Survey, SurveyResponse


class SurveyList(ListCreateAPI):
    """API endpoint for list of Survey objects.

    - GET: Return a list of all Survey objects (including questions and choices)
    - POST: Create a new Survey
    """

    queryset = Survey.objects.prefetch_related('questions__choices').all()
    serializer_class = SurveySerializers.SurveySerializer
    permission_classes = [permissions.IsAuthenticated, RolePermission]

    filter_backends = SEARCH_ORDER_FILTER

    filterset_fields = ['active']

    ordering_fields = ['title', 'created', 'active']

    ordering = ['-created']

    search_fields = ['title', 'description']


class SurveyDetail(RetrieveUpdateDestroyAPI):
    """API detail endpoint for a Survey object.

    - GET: Return a single Survey (including questions and choices)
    - PUT: Update a Survey
    - PATCH: Partially update a Survey
    - DELETE: Delete a Survey
    """

    queryset = Survey.objects.prefetch_related('questions__choices').all()
    serializer_class = SurveySerializers.SurveySerializer
    permission_classes = [permissions.IsAuthenticated, RolePermission]


@extend_schema_view(
    post=extend_schema(
        responses={201: SurveySerializers.SurveyResponseSerializer},
        description='Submit a completed survey response, including all answers',
    )
)
class SurveyResponseList(ListCreateAPI):
    """API endpoint for list of SurveyResponse objects.

    - GET: Return a list of submitted survey responses
    - POST: Submit a new survey response (including all answers)
    """

    queryset = SurveyResponse.objects.prefetch_related('answers').all()
    serializer_class = SurveySerializers.SurveyResponseSerializer
    permission_classes = [permissions.IsAuthenticated, RolePermission]

    filter_backends = SEARCH_ORDER_FILTER

    filterset_fields = ['survey', 'user']

    ordering_fields = ['submitted']

    ordering = ['-submitted']


survey_api_urls = [
    # survey responses
    path('response/', SurveyResponseList.as_view(), name='api-survey-response-list'),
    # detail view for a single survey
    path('<int:pk>/', SurveyDetail.as_view(), name='api-survey-detail'),
    # survey list and create
    path('', SurveyList.as_view(), name='api-survey-list'),
]
