import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

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

/**
 * Check if token is about to expire (within 5 minutes)
 */
function isTokenExpiringSoon(payload: any): boolean {
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fiveMinutesFromNow = nowSeconds + 300; // 5 minutes
  return payload.exp <= fiveMinutesFromNow;
}

/**
 * PrivateRoute - Enhanced Route Guard with Security Features
 * 
 * Features:
 * - Token expiration validation
 * - Role-based access control (RBAC)
 * - Automatic cleanup of invalid sessions
 * - Redirect to login with return path
 * - Security logging
 * - 🔒 Real-time localStorage monitoring
 * - 🔒 Periodic validation checks
 * 
 * Usage:
 * <PrivateRoute roles={['admin']}>
 *   <AdminDashboard />
 * </PrivateRoute>
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles }) => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const location = useLocation();

  useEffect(() => {
    const validate = () => {
      // Step 1: Check for access token
      const token = localStorage.getItem('accessToken');
      if (!token || token.trim() === '') {
        console.warn('[Security] No access token found');
        setAuthError('No authentication token');
        setAuthorized(false);
        return;
      }

      // Step 2: Decode and validate token structure
      const payload = decodeJwt(token);
      if (!payload) {
        console.warn('[Security] Invalid token structure');
        setAuthError('Invalid token');
        setAuthorized(false);
        return;
      }

      // Step 3: Check token expiration
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
        console.warn('[Security] Token expired');
        setAuthError('Session expired');
        setAuthorized(false);
        return;
      }

      // Step 4: Warn if token expiring soon (for future auto-refresh)
      if (isTokenExpiringSoon(payload)) {
        console.log('[Security] Token expiring soon - consider refreshing');
        // Future: Trigger automatic token refresh here
      }

      // Step 5: Role-based authorization
      if (roles && roles.length > 0) {
        try {
          const raw = localStorage.getItem('user');
          const user = raw ? JSON.parse(raw) : null;
          
          if (!user) {
            console.warn('[Security] User data not found');
            setAuthError('User data missing');
            setAuthorized(false);
            return;
          }

          const at = user?.account_type || {};
          const userRoles = Object.keys(at).filter(key => at[key] === true);
          const hasRole = roles.some((r) => at[r] === true);
          
          if (!hasRole) {
            console.warn(
              `[Security] Insufficient permissions - Required: [${roles.join(', ')}], ` +
              `User has: [${userRoles.join(', ')}]`
            );
            setAuthError('Insufficient permissions');
            setAuthorized(false);
            return;
          }

          console.log(`[Security] Authorization successful - User: ${user.acc_username}, Roles: [${userRoles.join(', ')}]`);
        } catch (error) {
          console.error('[Security] Error checking roles:', error);
          setAuthError('Authorization error');
          setAuthorized(false);
          return;
        }
      }

      // All checks passed
      setAuthorized(true);
    };

    // Initial validation
    validate();

    // 🔒 SECURITY FIX: Monitor localStorage changes
    // This detects when tokens are manually deleted
    const handleStorageChange = (e: StorageEvent) => {
      // Check if authentication-related items were removed
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === 'user') {
        if (e.newValue === null) {
          console.warn('[Security] Auth data removed - logging out');
          setAuthError('Session invalidated');
          setAuthorized(false);
        } else {
          // Re-validate if token changed
          validate();
        }
      }
    };

    // 🔒 SECURITY FIX: Periodic validation every 10 seconds
    // Catches manual deletions and expired tokens faster
    const intervalId = setInterval(() => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('[Security] Periodic check: Token missing');
        setAuthError('Session lost');
        setAuthorized(false);
      } else {
        // Re-validate token expiration
        const payload = decodeJwt(token);
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (!payload || typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
          console.warn('[Security] Periodic check: Token expired');
          setAuthError('Session expired');
          setAuthorized(false);
        }
      }
    }, 10000); // Check every 10 seconds (faster detection)

    // 🔒 SECURITY FIX: Detect when user returns to tab
    // Re-validates immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Security] Tab became visible - re-validating auth');
        validate();
      }
    };

    // 🔒 SECURITY FIX: Validate before page unload
    // Ensures clean state on refresh
    const handleBeforeUnload = () => {
      const token = localStorage.getItem('accessToken');
      if (!token || token.trim() === '') {
        console.log('[Security] No token found before unload - clearing storage');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    };

    // Listen for storage events (cross-tab changes)
    window.addEventListener('storage', handleStorageChange);
    // Listen for visibility changes (tab focus)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for page unload (refresh/close)
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
    };
  }, [roles, location.pathname]); // Re-validate on route change

  // Loading state
  if (authorized === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        <div>
          <div style={{ marginBottom: '10px' }}>🔒 Verifying access...</div>
          <div style={{ fontSize: '0.9rem', color: '#999' }}>Loading</div>
        </div>
      </div>
    );
  }

  // Unauthorized - clean up and redirect
  if (!authorized) {
    console.error(`[Security] Access denied to ${location.pathname} - Reason: ${authError}`);
    
    // Clean up all auth data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Redirect to login with return path
    return (
      <Navigate 
        to="/login" 
        replace 
        state={{ 
          from: location.pathname,
          error: authError 
        }} 
      />
    );
  }

  // Authorized - render protected content
  return children;
};
