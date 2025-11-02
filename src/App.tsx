import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/utils/queryClient';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Dashboard from './pages/admin/dashboard/index';
import Statistics from './pages/admin/statistics/index';
import ViewStats from './pages/admin/statistics/ViewStats';
import AlumniData from './pages/admin/statistics/AlumniData';
import Login from './pages/admin/Login/index';
import ForgotPassword from './pages/admin/ForgotPassword/index';
import TemporaryPassword from './pages/admin/TemporaryPassword/index';
import FirstLoginChangePassword from './pages/admin/TemporaryPassword/FirstLoginChangePassword';
import Tracker from './pages/admin/tracker/index';
// Legacy Users route now redirects to View Users
import Logout from './pages/admin/Logout/index';
import AlumniDashboard from './pages/alumni/Dashboard';
import PesoDashboard from './pages/peso/Dashboard';
import NotificationPage from './pages/alumni/Notification';
import AlumniTracker from './pages/alumni/Tracker';
import ForumPage from './pages/alumni/forum';
import DonationPage from './pages/alumni/Donation';
import Settings from './pages/alumni/Settings';

// import AlumniProfile from './pages/alumni/Profile';
import PesoProfile from './pages/peso/Profile';
import AdminDashboard from './pages/admin/dashboard/AdminDashboard';
import AdminProfilePage from './pages/admin/dashboard/AdminProfilePage';
import CoordinatorDashboard from './pages/coordinator/dashboard';
import RequestsPage from './pages/admin/pages/RequestsPage';
import UserManagement from './pages/admin/UserManagement';
import RequestDetailsPage from './pages/admin/pages/RequestDetailsPage';
import RewardsPage from './pages/admin/pages/RewardsPage';
import InventoryPage from './pages/admin/pages/InventoryPage';
import Messaging from './pages/messaging/Messaging';
import ReportSettingsPage from './pages/admin/report-settings/index';
// import other pages like Statistics, Users, etc.
import { PrivateRoute } from './components/PrivateRoute';
import AlumniProfile from './pages/alumni/Profile';
import UnifiedDashboard from './pages/shared/UnifiedDashboard';
import MobileDetector from './components/MobileDetector';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MobileDetector>
          <Router>
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
            path="/requests"
            element={
              <PrivateRoute roles={['admin']}>
                <RequestsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/requests/:year"
            element={
              <PrivateRoute roles={['admin']}>
                <RequestDetailsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <PrivateRoute roles={['admin']}>
                <RewardsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/report-settings"
            element={
              <PrivateRoute roles={['admin']}>
                <ReportSettingsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <PrivateRoute roles={['admin']}>
                <InventoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user-management"
            element={
              <PrivateRoute roles={['admin']}>
                <UserManagement />
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
            element={<Navigate to="/ViewStats" replace />}
          />
          {/* Unified dashboard for alumni and OJT users */}
          <Route
            path="/dashboard/:id"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <UnifiedDashboard userType="alumni" />
              </PrivateRoute>
            }
          />
          <Route
            path="/peso/dashboard/:id"
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
            path="/peso/profile/:id"
            element={
              <PrivateRoute>
                <PesoProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/peso/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/dashboard/:id"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/ccict/notification"
            element={
              <PrivateRoute>
                <NotificationPage />
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
            path="/ccict/profile/:id"
            element={
              <PrivateRoute>
                <AdminProfilePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/coordinator/dashboard/:id?"
            element={
              <PrivateRoute roles={['coordinator']}>
                <CoordinatorDashboard />
              </PrivateRoute>
            }
          />
          {/* Unified profile route for all users */}
          <Route
            path="/profile/:id"
            element={
              <PrivateRoute>
                <AlumniProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <AlumniProfile />
              </PrivateRoute>
            }
          />
          {/* OJT profile route */}
          <Route
            path="/ojt/profile/:id"
            element={
              <PrivateRoute>
                <AlumniProfile />
              </PrivateRoute>
            }
          />
          <Route
            path="/ojt/profile"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <AlumniProfile />
              </PrivateRoute>
            }
          />

          {/* Unified routes for alumni and OJT users */}
          <Route
            path="/forum"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <ForumPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/donation"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <DonationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <NotificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/tracker"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <AlumniTracker />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute roles={['user', 'ojt']}>
                <Settings />
              </PrivateRoute>
            }
          />

          {/* Keep old alumni tracker route for compatibility */}
          <Route
            path="/alumni/tracker"
            element={
              <PrivateRoute roles={['user']}>
                <AlumniTracker />
              </PrivateRoute>
            }
          />
          <Route
            path="/alumni/notifications"
            element={
              <PrivateRoute roles={['user']}>
                <NotificationPage />
              </PrivateRoute>
            }
          />

          {/* Messaging routes - available to all users with messaging access (alumni, OJT, admin, peso, coordinator) */}
          <Route
            path="/messages"
            element={
              <PrivateRoute roles={['user', 'ojt', 'admin', 'peso', 'coordinator']}>
                <Messaging />
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
        </MobileDetector>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
