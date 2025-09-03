import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AlumniTopBarProps {
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  handleLogout: () => void;
  isAdmin?: boolean;
  onTrackerClick?: () => void;
}

const AlumniTopBar: React.FC<AlumniTopBarProps> = ({ showProfile, setShowProfile, handleLogout, isAdmin, onTrackerClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  return (
    <div style={{ 
      background: '#174f84', 
      padding: '12px 24px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Logo and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            background: 'white', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 'bold',
            color: '#174f84'
          }}>
            WNY
          </div>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>WhereNa You</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search..." 
            style={{ 
              borderRadius: 20, 
              border: 'none', 
              padding: '8px 16px 8px 40px', 
              width: 300,
              fontSize: 14
            }} 
          />
          <span style={{ 
            position: 'absolute', 
            left: 12, 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: '#666',
            fontSize: 16
          }}>
            🔍
          </span>
        </div>
      </div>

      {/* Navigation Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => navigate('/alumni/dashboard')}>
          <span style={{ color: 'white', fontSize: 20 }}>🏠</span>
          <span style={{ color: 'white', fontSize: 12 }}>Home</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <span style={{ color: 'white', fontSize: 20 }}>✉️</span>
          <span style={{ color: 'white', fontSize: 12 }}>Messages</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => navigate('/alumni/notifications')}>
          <span style={{ color: 'white', fontSize: 20 }}>🔔</span>
          <span style={{ color: 'white', fontSize: 12 }}>Notification</span>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={onTrackerClick}>
            <span style={{ color: 'white', fontSize: 20 }}>📋</span>
            <span style={{ color: 'white', fontSize: 12 }}>Tracker</span>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setShowProfile(!showProfile)}>
            <span style={{ color: 'white', fontSize: 20 }}>👤</span>
            <span style={{ color: 'white', fontSize: 12 }}>Profile ▼</span>
          </div>
          {showProfile && (
            <div style={{ 
              position: 'absolute', 
              right: 0, 
              top: 40, 
              background: 'white', 
              color: '#174f84', 
              borderRadius: 8, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', 
              minWidth: 120, 
              zIndex: 10 
            }}>
              <div style={{ padding: 12, cursor: 'pointer' }} onClick={handleLogout}>Logout</div>
              <div style={{ padding: 12, cursor: 'pointer' }} onClick={() => setShowProfile(false)}>Close</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlumniTopBar; 