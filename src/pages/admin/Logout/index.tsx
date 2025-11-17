import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 🔒 SECURITY: Logout Component
 * 
 * Properly clears all authentication data before redirecting to login.
 * This is CRITICAL for security - tokens must be removed from localStorage.
 * 
 * What this does:
 * 1. Clears access token
 * 2. Clears refresh token
 * 3. Clears user data
 * 4. Logs the logout action
 * 5. Redirects to login page
 */
const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 🔒 SECURITY FIX: Properly clear all authentication data
    console.log('[Logout] Clearing authentication data');
    
    // Clear all auth tokens and user data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Optional: Clear any other app-specific data
    // Uncomment if you want to clear cached data on logout
    // localStorage.removeItem('lastVisitedRoute');
    // sessionStorage.clear();
    
    console.log('[Logout] Authentication cleared - redirecting to login');
    
    // Redirect to login page with replace to prevent back navigation
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#666',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        padding: '2rem',
        borderRadius: '12px',
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👋</div>
        <div>Logging out...</div>
        <div style={{ fontSize: '0.9rem', color: '#999', marginTop: '0.5rem' }}>
          Clearing session data
        </div>
      </div>
    </div>
  );
};

export default Logout;
