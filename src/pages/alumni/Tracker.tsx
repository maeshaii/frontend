import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTracker } from '../../hooks/useTracker';
import Question from '../admin/tracker/questions';

function useQuery() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id');
  console.log('🔍 URL Debug - All search params:', Object.fromEntries(searchParams.entries()));
  console.log('🔍 URL Debug - user_id param:', userId);
  return userId;
}

const AlumniTracker: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Get user_id from URL or fallback to logged-in user
  const getUserId = () => {
    if (query) {
      return query; // Use URL parameter if available
    }
    
    // Fallback to logged-in user
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userObj = JSON.parse(user);
        return userObj.user_id || userObj.id;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    return null;
  };
  
  const userId = getUserId();
  console.log('🔍 Tracker Debug - User ID from URL:', query);
  console.log('🔍 Tracker Debug - Final User ID:', userId);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      const user = localStorage.getItem('user');
      
      if (!token || !user) {
        console.log('🔍 Tracker Debug - No token or user found, redirecting to login');
        setIsAuthenticated(false);
        return;
      }
      
      try {
        const userObj = JSON.parse(user);
        console.log('🔍 Tracker Debug - Current user:', userObj);
        
        // Check if the user_id in URL matches the logged-in user (only if URL has user_id)
        if (query && userObj.user_id && userObj.user_id.toString() !== query) {
          console.log('🔍 Tracker Debug - User ID mismatch, redirecting to login');
          setIsAuthenticated(false);
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('🔍 Tracker Debug - Error parsing user data:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, [userId]);
  
  const { state } = useTracker(userId);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
          <button
            onClick={() => navigate('/alumni/notifications')}
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              background: '#174f84',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#164B87',
              margin: '0',
              fontSize: '2rem',
              letterSpacing: '1px',
            }}
          >
            CTU MAIN ALUMNI TRACKER
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontSize: 20,
              color: '#174f84',
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            Checking authentication...
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (isAuthenticated === false) {
    navigate('/login');
    return null;
  }

  if (state.loading) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
          <button
            onClick={() => navigate('/alumni/notifications')}
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              background: '#174f84',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#164B87',
              margin: '0',
              fontSize: '2rem',
              letterSpacing: '1px',
            }}
          >
            CTU MAIN ALUMNI TRACKER
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontSize: 20,
              color: '#174f84',
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            Loading tracker form...
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
          <button
            onClick={() => navigate('/alumni/notifications')}
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              background: '#174f84',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#164B87',
              margin: '0',
              fontSize: '2rem',
              letterSpacing: '1px',
            }}
          >
            CTU MAIN ALUMNI TRACKER
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontSize: 20,
              color: '#e74c3c',
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            Error: {state.error}
            <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
              Please contact support if this persists.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.showMessage) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
          <button
            onClick={() => navigate('/alumni/notifications')}
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              background: '#174f84',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#164B87',
              margin: '0',
              fontSize: '2rem',
              letterSpacing: '1px',
            }}
          >
            CTU MAIN ALUMNI TRACKER
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontSize: 20,
              color: '#174f84',
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            {state.message}
            <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
              Redirecting to notifications...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If form is not accepting responses, show message and redirect
  if (state.accepting === false) {
    return (
      <div style={{ background: '#add8e6', minHeight: '100vh', padding: '0', margin: '0' }}>
        <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
          <button
            onClick={() => navigate('/alumni/notifications')}
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              background: '#174f84',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#164B87',
              margin: '0',
              fontSize: '2rem',
              letterSpacing: '1px',
            }}
          >
            CTU MAIN ALUMNI TRACKER
          </h2>
        </div>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div
            style={{
              textAlign: 'center',
              marginTop: 40,
              fontSize: 20,
              color: '#174f84',
              background: 'white',
              padding: 32,
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
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
      {/* Header with back button and title */}
      <div style={{ position: 'relative', padding: '32px 20px 8px 20px' }}>
        <button
          onClick={() => navigate('/alumni/notifications')}
          style={{
            position: 'absolute',
            left: 20,
            top: 20,
            background: '#174f84',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          ← Back
        </button>
        <h2
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            color: '#164B87',
            margin: '0',
            fontSize: '2rem',
            letterSpacing: '1px',
          }}
        >
          CTU MAIN ALUMNI TRACKER
        </h2>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Question previewModeFromParent={true} userId={userId} />
      </div>
    </div>
  );
};

export default AlumniTracker;
