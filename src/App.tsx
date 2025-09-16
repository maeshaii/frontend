import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/utils/queryClient';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/admin/dashboard/index';
import Statistics from './pages/admin/statistics/index';
import ViewStats from './pages/admin/statistics/ViewStats';
import AlumniData from './pages/admin/statistics/AlumniData';
import Login from './pages/admin/Login/index';
import ForgotPassword from './pages/admin/ForgotPassword/index';
import TemporaryPassword from './pages/admin/TemporaryPassword/index';
import FirstLoginChangePassword from './pages/admin/TemporaryPassword/FirstLoginChangePassword';
import Tracker from './pages/admin/tracker/index';
import Users from './pages/admin/users/index';
import Logout from './pages/admin/Logout/index';
import AlumniDashboard from './pages/alumni/Dashboard';
import PesoDashboard from './pages/peso/Dashboard';
import NotificationPage from './pages/alumni/Notification';
import AlumniTracker from './pages/alumni/Tracker';
import ForumPage from './pages/alumni/forum';

// import AlumniProfile from './pages/alumni/Profile';
import PesoProfile from './pages/peso/Profile';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import AdminNotificationPage from './pages/admin/dashboard/AdminNotification';
import AdminProfilePage from './pages/admin/dashboard/AdminProfilePage';
import CoordinatorDashboard from './pages/coordinator/dashboard';
// import other pages like Statistics, Users, etc.
import { PrivateRoute } from './components/PrivateRoute';
import UnifiedProfile from './pages/shared/UnifiedProfile';
import ScrollToTop from './components/ScrollToTop';

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Redirect root URL to /login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Actual routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/temporary-password" element={<TemporaryPassword />} />
          <Route path="/first-login-change-password" element={<FirstLoginChangePassword />} />
          <Route path="/logout" element={<Logout />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute roles={['admin']}>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <PrivateRoute>
                <Statistics />
              </PrivateRoute>
            }
          />
          <Route
            path="/ViewStats"
            element={
              <PrivateRoute roles={['admin']}>
                <ViewStats />
              </PrivateRoute>
            }
          />
          <Route
            path="/AlumniData/:year"
            element={
              <PrivateRoute roles={['admin']}>
                <AlumniData />
              </PrivateRoute>
            }
          />
          <Route
            path="/tracker/*"
            element={
              <PrivateRoute>
                <Tracker />
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute roles={['admin']}>
                <Users />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/dashboard"
            element={
              <PrivateRoute roles={['user']}>
                <AlumniDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/peso/dashboard"
            element={
              <PrivateRoute roles={['peso']}>
                <PesoDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/peso/notifications"
            element={
              <PrivateRoute>
                <NotificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/peso/profile"
            element={
              <PrivateRoute>
                <PesoProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/profile"
            element={
              <PrivateRoute>
                <UnifiedProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/forum"
            element={
              <PrivateRoute>
                <ForumPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/notifications"
            element={
              <PrivateRoute>
                <NotificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/tracker"
            element={
              <PrivateRoute>
                <AlumniTracker />
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/dashboard"
            element={
              <PrivateRoute>
                <AdminDashboard/>
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/notification"
            element={
              <PrivateRoute>
                <AdminNotificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/profile"
            element={
              <PrivateRoute>
                <AdminProfilePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/coordinator/dashboard"
            element={
              <PrivateRoute roles={['coordinator']}>
                <CoordinatorDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/profile/:id"
            element={
              <PrivateRoute>
                <UnifiedProfile />
              </PrivateRoute>
            }
          />

          {/* Add more routes like:
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/users" element={<Users />} />
        etc.
        */}
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
