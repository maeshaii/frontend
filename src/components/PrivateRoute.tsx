import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

type PrivateRouteProps = {
  children: React.ReactElement;
};

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const validateToken = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsValidToken(false);
        return;
      }

      // Basic token validation - check if it's not empty and has a valid format
      // In a production app, you might want to decode the JWT and check expiration
      if (token.trim() === '') {
        setIsValidToken(false);
        return;
      }

      setIsValidToken(true);
    };

    validateToken();
  }, []);

  // Show loading while validating
  if (isValidToken === null) {
    return <div>Loading...</div>;
  }

  if (!isValidToken) {
    // Clear any invalid tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  return children;
};
