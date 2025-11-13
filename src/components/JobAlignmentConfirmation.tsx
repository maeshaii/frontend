import React, { useState, useEffect } from 'react';
import { api, publicApi } from '../services/api';

interface JobAlignmentSuggestion {
  employment_id: number;
  position_current: string;
  company_name_current: string;
  suggested_job_title: string;
  suggested_program: string;
  original_program: string;
  question: string;
}

interface JobAlignmentConfirmationProps {
  position: string;
  userId: number;
  onAlignmentComplete?: (status: string) => void;
}

const JobAlignmentConfirmation: React.FC<JobAlignmentConfirmationProps> = ({
  position,
  userId,
  onAlignmentComplete
}) => {
  const [suggestion, setSuggestion] = useState<JobAlignmentSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    checkJobAlignment();
  }, [position, userId]);

  const checkJobAlignment = async () => {
    if (!position.trim()) return;
    
    setLoading(true);
    try {
      const response = await publicApi.post('/shared/check-job-alignment/', {
        position: position,
        user_id: userId
      });

        if (response.data.needs_confirmation) {
          // Create suggestion object for pending confirmation
          const suggestionData = response.data.suggestion || {};
          setSuggestion({
            employment_id: suggestionData.employment_id || 0,
            position_current: position,
            company_name_current: '',
            suggested_job_title: position,
            suggested_program: suggestionData.user_program || '',
            original_program: suggestionData.user_program || '',
            question: suggestionData.question || `Is '${position}' aligned to your program?`
          });
        } else {
          onAlignmentComplete?.(response.data.job_alignment_status);
        }
    } catch (error) {
      console.error('Error checking job alignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmation = async () => {
    if (!suggestion || selectedAnswer === null) return;

    setSubmitting(true);
    try {
      const confirmed = selectedAnswer === 'yes';
      
      const response = await publicApi.post('/shared/confirm-job-alignment/', {
        employment_id: suggestion.employment_id,
        confirmed: confirmed,
        user_id: userId
      });

      if (response.data.success) {
        onAlignmentComplete?.(response.data.job_alignment_status);
        setSuggestion(null);
        setSelectedAnswer(null);
      }
    } catch (error) {
      console.error('Error confirming job alignment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="job-alignment-loading">
        <div className="spinner"></div>
        <p>Checking job alignment...</p>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  return (
    <div className="job-alignment-confirmation">
      <div className="confirmation-card">
        <div className="confirmation-header">
          <h3>🤔 Job Alignment Question</h3>
        </div>
        
        <div className="confirmation-content">
          <div className="confirmation-question">
            <h4>{suggestion.question}</h4>
            
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="alignment-confirmation"
                  value="yes"
                  checked={selectedAnswer === 'yes'}
                  onChange={() => setSelectedAnswer('yes')}
                />
                <span className="radio-label">✅ Yes, this job is aligned to my program</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="alignment-confirmation"
                  value="no"
                  checked={selectedAnswer === 'no'}
                  onChange={() => setSelectedAnswer('no')}
                />
                <span className="radio-label">❌ No, this job is not aligned to my program</span>
              </label>
            </div>
          </div>
          
          <div className="confirmation-actions">
            <button
              onClick={handleConfirmation}
              disabled={selectedAnswer === null || submitting}
              className="confirm-button"
            >
              {submitting ? 'Processing...' : 'Confirm Answer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobAlignmentConfirmation;
