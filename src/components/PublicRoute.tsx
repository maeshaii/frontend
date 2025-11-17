import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

type PublicRouteProps = {
  children: React.ReactElement;
  /**
   * If true, authenticated users can still access this route.
   * If false (default), authenticated users will be redirected to their dashboard.
   */
  allowAuthenticated?: boolean;
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

function getUserDashboardRoute(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '/login';
    
    const user = JSON.parse(raw);
    const userId = user.user_id || user.id;
    const accountType = user.account_type || {};
    
    // Route to appropriate dashboard based on role
    if (accountType.admin) {
      return '/dashboard';
    } else if (accountType.peso) {
      return `/peso/dashboard/${userId}`;
    } else if (accountType.coordinator) {
      return `/coordinator/dashboard/${userId}`;
    } else if (accountType.user || accountType.ojt) {
      return `/dashboard/${userId}`;
    }
    
    // Default fallback
    return '/dashboard';
  } catch (error) {
    console.error('Error determining dashboard route:', error);
    return '/login';
  }
}

/**
 * PublicRoute - Protects authentication pages from authenticated users
 * 
 * Purpose: Prevents logged-in users from accessing login, forgot password, etc.
 * 
 * Security Best Practice:
 * - If user is authenticated and tries to access /login, redirect to dashboard
 * - Prevents confusion and potential security issues
 * - Ensures clean user experience
 * 
 * @example
 * <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  allowAuthenticated = false 
}) => {
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const checkAuthentication = () => {
      const token = localStorage.getItem('accessToken');
      const user = localStorage.getItem('user');
      
      // No token or user = not authenticated
      if (!token || !user || token.trim() === '' || user.trim() === '') {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        return;
      }

      // Validate token expiry
      const payload = decodeJwt(token);
      const nowSeconds = Math.floor(Date.now() / 1000);
      
      if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
        // Token expired or invalid - clean up
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setCheckingAuth(false);
        return;
      }

      // Valid authentication found
      setIsAuthenticated(true);
      setCheckingAuth(false);
    };

    // Initial check
    checkAuthentication();

    // 🔒 SECURITY FIX: Monitor localStorage changes (cross-tab and manual changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === 'user') {
        console.log('[PublicRoute Security] Auth data changed - re-checking authentication');
        checkAuthentication();
      }
    };

    // 🔒 SECURITY FIX: Re-validate when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PublicRoute Security] Tab became visible - re-checking authentication');
        checkAuthentication();
      }
    };

    // 🔒 SECURITY FIX: Periodic validation every 5 seconds (faster than PrivateRoute)
    // This ensures authenticated users are redirected away from login page quickly
    const intervalId = setInterval(() => {
      const token = localStorage.getItem('accessToken');
      if (token && token.trim() !== '') {
        const payload = decodeJwt(token);
        const nowSeconds = Math.floor(Date.now() / 1000);
        // If token is valid and user is on login page, redirect them
        if (payload && typeof payload.exp === 'number' && payload.exp > nowSeconds) {
          console.log('[PublicRoute Security] Periodic check: Valid token found - user should be redirected');
          setIsAuthenticated(true);
          setCheckingAuth(false);
        }
      }
    }, 5000); // Check every 5 seconds (faster detection than PrivateRoute)

    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  // If authenticated and this route doesn't allow authenticated users,
  // redirect to their appropriate dashboard
  if (isAuthenticated && !allowAuthenticated) {
    const dashboardRoute = getUserDashboardRoute();
    console.log('PublicRoute: User is authenticated, redirecting to:', dashboardRoute);
    return <Navigate to={dashboardRoute} replace />;
  }

  // Either not authenticated, or authenticated but allowed to view
  return children;
};

