import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

type Role = 'admin' | 'peso' | 'user' | 'coordinator' | 'ojt';

type PrivateRouteProps = {
  children: React.ReactElement;
  roles?: Role[]; // Optional role restriction
};

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles }) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const validate = () => {
      const token = localStorage.getItem('accessToken');
      if (!token || token.trim() === '') {
        setAuthorized(false);
        return;
      }

      const payload = decodeJwt(token);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
        // Expired or invalid
        setAuthorized(false);
        return;
      }

      if (roles && roles.length > 0) {
        try {
          const raw = localStorage.getItem('user');
          const user = raw ? JSON.parse(raw) : null;
          const at = user?.account_type || {};
          
          // Debug logging
          console.log('🔍 PRIVATE ROUTE DEBUG: Required roles:', roles);
          console.log('🔍 PRIVATE ROUTE DEBUG: User object:', user);
          console.log('🔍 PRIVATE ROUTE DEBUG: Account type:', at);
          
          const hasRole = roles.some((r) => at[r] === true);
          console.log('🔍 PRIVATE ROUTE DEBUG: Has required role:', hasRole);
          
          setAuthorized(!!hasRole);
          return;
        } catch (error) {
          console.error('🔍 PRIVATE ROUTE DEBUG: Error parsing user:', error);
          setAuthorized(false);
          return;
        }
      }

      setAuthorized(true);
    };

    validate();
  }, [roles]);

  if (authorized === null) {
    return <div>Loading...</div>;
  }

  if (!authorized) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Keep user for potential UX, but it's safer to clear it as well
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  return children;
};
