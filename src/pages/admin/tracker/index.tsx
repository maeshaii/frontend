import React from 'react';
import './Tracker.css';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import Question from './questions';
import Responses from './responses';
import Setting from './settings';

const Tracker: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string): boolean => location.pathname === path;

  return (
    <div style={{ display: 'flex'}}>
      <Sidebar />

      <div className="tracker-container" style={{ flex: 1, padding: '20px' }}>
        <div className="tracker-inner">

          {/* Header */}
          <div className="tracker-header">
            {/* Replace editable/dynamic title with static, non-editable title */}
            <h2 className="form-title" style={{ fontWeight: 'bold', color: '#164B87', margin: 0 }}>
              CTU MAIN ALUMNI TRACKER
            </h2>
            <div className="tracker-tabs">
              <Link to="/tracker/questions" className={isActive('/tracker/questions') ? 'active' : ''}>
                Questions
              </Link>
              <Link to="/tracker/responses" className={isActive('/tracker/responses') ? 'active' : ''}>
                Responses
              </Link>
              <Link to="/tracker/settings" className={isActive('/tracker/settings') ? 'active' : ''}>
                Settings
              </Link>
            </div>
          </div>

          {/* Tab Content */}
          <Routes>
            <Route index element={<Navigate to="questions" replace />} />
            <Route path="questions" element={<Question />} />
            <Route path="responses" element={<Responses />} />
            <Route path="settings" element={<Setting />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Tracker;
