import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlumniDetails } from '../services/api';
import { trackerApi, trackerUtils } from '../services/trackerApi';

interface TrackerState {
  hasSubmitted: boolean | null;
  loading: boolean;
  accepting: boolean | null;
  trackerFormId: number | null;
  showMessage: boolean;
  message: string;
  userBatchYear: number | null;
  isCorrectBatch: boolean | null;
  error: string | null;
}

export const useTracker = (userId: string | null) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TrackerState>({
    hasSubmitted: null,
    loading: true,
    accepting: null,
    trackerFormId: null,
    showMessage: false,
    message: '',
    userBatchYear: null,
    isCorrectBatch: null,
    error: null,
  });

  const updateState = useCallback((updates: Partial<TrackerState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const redirectWithMessage = useCallback(
    (message: string, delay: number = 3000) => {
      updateState({
        showMessage: true,
        message,
        loading: false,
      });

      setTimeout(() => {
        navigate('/alumni/notifications');
      }, delay);
    },
    [navigate, updateState]
  );

  const validateBatchYear = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        const targetBatchYear = trackerUtils.getTargetBatchYear();
        console.log('🔍 Tracker Debug - Target batch year:', targetBatchYear);

        const userDetails = await fetchAlumniDetails(userId);
        console.log('🔍 Tracker Debug - User details response:', userDetails);

        if (!userDetails?.success || !userDetails?.alumni) {
          console.error('🔍 Tracker Debug - Failed to get user details:', userDetails);
          redirectWithMessage(
            'Unable to verify your batch year. This tracker form is only available for specific alumni batches.'
          );
          return false;
        }

        // Prefer alumni.batch; fallback to alumni.year_graduated; coerce to number
        const rawYear = userDetails.alumni.batch ?? userDetails.alumni.year_graduated ?? null;
        const userYear = rawYear !== null ? Number(rawYear) : null;
        console.log('🔍 Tracker Debug - Raw year:', rawYear, 'Coerced userYear:', userYear);

        if (userYear === null || Number.isNaN(userYear)) {
          redirectWithMessage(
            'Unable to determine your batch year. Please contact support for assistance.'
          );
          return false;
        }

        updateState({
          userBatchYear: userYear,
          isCorrectBatch: trackerUtils.validateBatchYear(userYear),
        });

        if (!trackerUtils.validateBatchYear(userYear)) {
          redirectWithMessage(
            `This tracker form is only available for batch ${targetBatchYear} alumni. You are from batch ${userYear}.`
          );
          return false;
        }

        console.log('🔍 Tracker Debug - Batch validation successful');
        return true;
      } catch (error) {
        console.error('🔍 Tracker Debug - Error in validateBatchYear:', error);
        redirectWithMessage('Error validating batch year. Please try again later.');
        return false;
      }
    },
    [redirectWithMessage, updateState]
  );

  const initializeTracker = useCallback(async () => {
    if (!userId) {
      updateState({ loading: false, hasSubmitted: false });
      return;
    }

    try {
      // Step 1: Get active tracker form
      const activeFormData = await trackerApi.getActiveForm();
      const formId = activeFormData.tracker_form_id;
      updateState({ trackerFormId: formId });

      // Step 2: Validate batch year
      const isValidBatch = await validateBatchYear(userId);
      if (!isValidBatch) return;

      // Step 3: Check form status and submission
      const [acceptingData, submissionData] = await Promise.all([
        trackerApi.getAcceptingStatus(formId),
        trackerApi.checkSubmissionStatus(userId),
      ]);

      updateState({
        accepting: acceptingData.accepting_responses,
        hasSubmitted: submissionData.has_submitted,
        loading: false,
      });

      // Handle form closed or already submitted
      if (submissionData.has_submitted || !acceptingData.accepting_responses) {
        let messageText = '';
        if (submissionData.has_submitted && !acceptingData.accepting_responses) {
          messageText = 'You have already submitted the tracker form. It is now closed.';
        } else if (submissionData.has_submitted) {
          messageText = 'You have already completed the tracker form. Thank you!';
        } else if (!acceptingData.accepting_responses) {
          messageText = 'The tracker form is currently closed. Please check back later.';
        }

        redirectWithMessage(messageText);
      }
    } catch (error) {
      updateState({
        loading: false,
        hasSubmitted: false,
        accepting: null,
        isCorrectBatch: false,
        error: trackerUtils.getErrorMessage(error),
      });
    }
  }, [userId, validateBatchYear, redirectWithMessage, updateState]);

  useEffect(() => {
    initializeTracker();
  }, [initializeTracker]);

  // Handle redirect for cases where form is closed, already submitted, or wrong batch
  useEffect(() => {
    if (
      !state.loading &&
      (state.hasSubmitted || state.accepting === false || state.isCorrectBatch === false)
    ) {
      const timer = setTimeout(() => {
        navigate('/alumni/notifications');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [state.loading, state.hasSubmitted, state.accepting, state.isCorrectBatch, navigate]);

  return {
    state,
    updateState,
    redirectWithMessage,
  };
};
