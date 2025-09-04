import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any authentication state here if applicable
    // For example, clear tokens, user info, etc.
    // localStorage.removeItem('authToken');
    // localStorage.removeItem('user');

    // Redirect to login page
    navigate('/login', { replace: true });
  }, [navigate]);

  return null; // No UI needed
};

export default Logout;
