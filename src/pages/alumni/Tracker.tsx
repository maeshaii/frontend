import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Question from '../admin/tracker/questions';
import { fetchTrackerResponsesByUser, fetchAlumniDetails } from '../../services/api';

// Helper to get query params
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const AlumniTracker: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const userId = query.get('user_id');
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [trackerFormId, setTrackerFormId] = useState<number | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [userBatchYear, setUserBatchYear] = useState<number | null>(null);
  const [isCorrectBatch, setIsCorrectBatch] = useState<boolean | null>(null);

  useEffect(() => {
    // Fetch trackerFormId from backend
    fetch('http://127.0.0.1:8000/api/tracker/active-form/')
      .then(res => res.json())
      .then(data => setTrackerFormId(data.tracker_form_id));
  }, []);

  useEffect(() => {
    const checkSubmission = async () => {
      if (!userId || !trackerFormId) {
        setHasSubmitted(false);
        setLoading(false);
        return;
      }
      try {
        // Calculate target batch year (current year - 2)
        const currentYear = new Date().getFullYear();
        const targetBatchYear = currentYear - 2;
        
        // Fetch user details to get their batch year
        const userDetails = await fetchAlumniDetails(userId);
        console.log('User details:', userDetails); // Debug log
        if (userDetails.success && userDetails.alumni) {
          const userYear = userDetails.alumni.batch || userDetails.alumni.year_graduated;
          console.log('User year:', userYear, 'Target year:', targetBatchYear); // Debug log
          setUserBatchYear(userYear);
          setIsCorrectBatch(userYear === targetBatchYear);
          
          // If user is not from the correct batch, show message and redirect
          if (userYear !== targetBatchYear) {
            setMessage(`This tracker form is only available for batch ${targetBatchYear} alumni. You are from batch ${userYear}.`);
            setShowMessage(true);
            setTimeout(() => {
              navigate('/alumni/notifications');
            }, 3000);
            setLoading(false);
            return;
          }
        } else {
          // If we can't fetch user details, assume they're not from the correct batch
          setIsCorrectBatch(false);
          setMessage('Unable to verify your batch year. This tracker form is only available for specific alumni batches.');
          setShowMessage(true);
          setTimeout(() => {
            navigate('/alumni/notifications');
          }, 3000);
          setLoading(false);
          return;
        }
        
        // Fetch accepting state
        const aRes = await fetch(`http://127.0.0.1:8000/api/tracker/accepting/${trackerFormId}/`);
        const aData = await aRes.json();
        setAccepting(aData.accepting_responses);
        // Check submission
        const res = await fetch(`http://127.0.0.1:8000/api/tracker/check-status/?user_id=${userId}`);
        const data = await res.json();
        setHasSubmitted(data.has_submitted);
        
        // Show message and redirect if already submitted or form is closed
        if (data.has_submitted || !aData.accepting_responses) {
          let messageText = '';
          if (data.has_submitted && !aData.accepting_responses) {
            messageText = 'You have already submitted the tracker form. It is now closed.';
          } else if (data.has_submitted) {
            messageText = 'You have already completed the tracker form. Thank you!';
          } else if (!aData.accepting_responses) {
            messageText = 'The tracker form is currently closed. Please check back later.';
          }
          
          setMessage(messageText);
          setShowMessage(true);
          
          // Redirect to notification page after 3 seconds
          setTimeout(() => {
            navigate('/alumni/notifications');
          }, 3000);
        }
      } catch (e) {
        setHasSubmitted(false);
        setAccepting(null);
        setIsCorrectBatch(false);
      } finally {
        setLoading(false);
      }
    };
    checkSubmission();
  }, [userId, trackerFormId, navigate]);

  // Handle redirect for cases where form is closed, already submitted, or wrong batch
  useEffect(() => {
    if (!loading && (hasSubmitted || accepting === false || isCorrectBatch === false)) {
      const timer = setTimeout(() => {
        navigate('/alumni/notifications');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [loading, hasSubmitted, accepting, isCorrectBatch, navigate]);

  // Debug logging
  useEffect(() => {
    if (!loading) {
      console.log('Tracker state:', {
        hasSubmitted,
        accepting,
        isCorrectBatch,
        userBatchYear,
        showMessage,
        message
      });
    }
  }, [loading, hasSubmitted, accepting, isCorrectBatch, userBatchYear, showMessage, message]);

  if (loading) return <div>Loading...</div>;
  
  // Show message and redirect if already submitted or form is closed
  if (showMessage) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <h2 style={{ textAlign: 'center', fontWeight: 'bold', color: '#164B87', margin: '0', padding: '32px 0 8px 0', fontSize: '2rem', letterSpacing: '1px' }}>
          CTU MAIN ALUMNI TRACKER
        </h2>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 20, color: '#174f84', background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {message}
            <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
              Redirecting to notifications in 3 seconds...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If form is not accepting responses, show message and redirect
  if (accepting === false) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <h2 style={{ textAlign: 'center', fontWeight: 'bold', color: '#164B87', margin: '0', padding: '32px 0 8px 0', fontSize: '2rem', letterSpacing: '1px' }}>
          CTU MAIN ALUMNI TRACKER
        </h2>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 20, color: '#174f84', background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            The tracker form is currently closed. Please check back later.
            <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
              Redirecting to notifications in 3 seconds...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
      {/* Title at the very top, above everything else */}
      <h2 style={{ textAlign: 'center', fontWeight: 'bold', color: '#164B87', margin: '0', padding: '32px 0 8px 0', fontSize: '2rem', letterSpacing: '1px' }}>
        CTU MAIN ALUMNI TRACKER
      </h2>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {hasSubmitted ? (
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 20, color: '#174f84', background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            You have already completed the tracker form. Thank you!
            <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
              Redirecting to notifications in 3 seconds...
            </div>
          </div>
        ) : (
          <Question previewModeFromParent={true} userId={userId} />
        )}
      </div>
    </div>
  );
};

export default AlumniTracker; 