import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Paper,
  Radio,
  Rating,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { StylishText } from '@lib/components/StylishText';
import { api } from '../../App';
import { PageDetail } from '../../components/nav/PageDetail';
import { showApiErrorMessage } from '../../functions/notifications';

interface SurveyChoice {
  pk: number;
  text: string;
  order: number;
}

interface SurveyQuestion {
  pk: number;
  text: string;
  question_type:
    | 'text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'boolean';
  order: number;
  required: boolean;
  choices: SurveyChoice[];
}

interface SurveyInstance {
  pk: number;
  title: string;
  description: string;
  active: boolean;
  questions: SurveyQuestion[];
}

type AnswerValue = string | string[] | number | boolean | null;

/**
 * Render the input widget associated with a single survey question
 */
function QuestionInput({
  question,
  value,
  onChange
}: Readonly<{
  question: SurveyQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}>) {
  switch (question.question_type) {
    case 'text':
      return (
        <Textarea
          aria-label={question.text}
          autosize
          minRows={2}
          value={(value as string) ?? ''}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    case 'single_choice':
      return (
        <Radio.Group
          aria-label={question.text}
          value={(value as string) ?? ''}
          onChange={onChange}
        >
          <Stack gap='xs'>
            {question.choices.map((choice) => (
              <Radio
                key={choice.pk}
                value={String(choice.pk)}
                label={choice.text}
              />
            ))}
          </Stack>
        </Radio.Group>
      );
    case 'multiple_choice':
      return (
        <Checkbox.Group
          aria-label={question.text}
          value={(value as string[]) ?? []}
          onChange={onChange}
        >
          <Stack gap='xs'>
            {question.choices.map((choice) => (
              <Checkbox
                key={choice.pk}
                value={String(choice.pk)}
                label={choice.text}
              />
            ))}
          </Stack>
        </Checkbox.Group>
      );
    case 'rating':
      return (
        <Rating
          aria-label={question.text}
          value={(value as number) ?? 0}
          onChange={onChange}
        />
      );
    case 'boolean':
      return (
        <Switch
          aria-label={question.text}
          checked={!!value}
          onChange={(event) => onChange(event.currentTarget.checked)}
          label={value ? t`Yes` : t`No`}
        />
      );
    default:
      return (
        <TextInput
          aria-label={question.text}
          value={(value as string) ?? ''}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
  }
}

/**
 * Serialize an answer value into the string representation expected by the API
 */
function serializeAnswer(value: AnswerValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(',');
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

/**
 * Page for filling out (and submitting) a single survey
 */
export default function SurveyResponse() {
  const { id } = useParams();

  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  const surveyQuery = useQuery<SurveyInstance>({
    enabled: !!id,
    queryKey: ['survey', id],
    queryFn: async () =>
      api.get(apiUrl(ApiEndpoints.survey_list, id)).then((res) => res.data)
  });

  const survey = surveyQuery.data;

  const setAnswer = useCallback((question: number, value: AnswerValue) => {
    setAnswers((existing) => ({ ...existing, [question]: value }));
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () =>
      api.post(apiUrl(ApiEndpoints.survey_response_list), {
        survey: survey?.pk,
        answers:
          survey?.questions.map((question) => ({
            question: question.pk,
            value: serializeAnswer(answers[question.pk])
          })) ?? []
      }),
    onSuccess: () => {
      setSubmitted(true);
      showNotification({
        title: t`Success`,
        message: t`Survey response submitted`,
        color: 'green'
      });
    },
    onError: (error: any) => {
      showApiErrorMessage({
        error: error,
        title: t`Error submitting survey response`
      });
    }
  });

  const missingRequired: boolean = !!survey?.questions.some((question) => {
    if (!question.required) {
      return false;
    }

    const value = answers[question.pk];

    if (question.question_type === 'boolean') {
      return value === undefined;
    }

    return serializeAnswer(value).length === 0;
  });

  if (surveyQuery.isLoading) {
    return <Skeleton />;
  }

  if (surveyQuery.isError || !survey) {
    return (
      <Alert color='red' title={t`Error`}>
        <Trans>The requested survey could not be loaded</Trans>
      </Alert>
    );
  }

  return (
    <Stack gap='xs'>
      <PageDetail title={survey.title} />
      <Stack gap='sm'>
        {survey.description && <Text size='sm'>{survey.description}</Text>}
        {submitted && (
          <Alert color='green' title={t`Thank you`}>
            <Trans>Your response has been recorded</Trans>
          </Alert>
        )}
        {survey.questions.map((question, index) => (
          <Paper key={question.pk} p='sm' withBorder>
            <Stack gap='xs'>
              <StylishText size='sm'>
                {`${index + 1}. ${question.text}${question.required ? ' *' : ''}`}
              </StylishText>
              <QuestionInput
                question={question}
                value={answers[question.pk] ?? null}
                onChange={(value) => setAnswer(question.pk, value)}
              />
            </Stack>
          </Paper>
        ))}
        <Group justify='right'>
          <Button
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={missingRequired || submitted}
          >
            <Trans>Submit</Trans>
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
