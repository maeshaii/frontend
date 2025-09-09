import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ctulogo from '../../images/ctulogo.png';
import { api } from '../../services/api';

interface AlumniTopBarProps {
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  handleLogout: () => void;
  isAdmin?: boolean;
  isPeso?: boolean;
  onTrackerClick?: () => void;
  onHomeClick?: () => void;
}

const AlumniTopBar: React.FC<AlumniTopBarProps> = ({
  showProfile,
  setShowProfile,
  handleLogout,
  isAdmin,
  isPeso,
  onTrackerClick,
  onHomeClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchValue, setSearchValue] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // New state for notification count
  const [notificationCount, setNotificationCount] = React.useState(0);

  React.useEffect(() => {
    // Fetch notification count from API (uses axios instance with auth)
    api
      .get('notifications/count')
      .then(res => {
        const data = res.data;
        if (data && typeof data.count === 'number') {
          setNotificationCount(data.count);
        }
      })
      .catch(() => {
        setNotificationCount(0);
      });
  }, []);

  React.useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchValue.trim() !== '') {
        api
          .get(`alumni/search/`, { params: { q: searchValue } })
          .then((res) => {
            const data = res.data;
            const raw = Array.isArray(data) ? data : (data.results || data.users || []);
            const userStr = localStorage.getItem('user');
            let filteredData = raw;
            if (userStr) {
              const userObj = JSON.parse(userStr);
              filteredData = (raw || []).filter((user: any) => {
                const userIdInResult = user.user_id ?? user.id;
                const userIdInStorage = userObj.user_id ?? userObj.id;
                return userIdInResult !== userIdInStorage;
              });
            }
            setSearchResults(filteredData);
            setShowSuggestions(true);
          })
          .catch(() => {
            setSearchResults([]);
            setShowSuggestions(false);
          });
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 300); // debounce delay

    return () => clearTimeout(delayDebounce);
  }, [searchValue]);


  const handleSearchSelect = (userId: number) => {
    setShowSuggestions(false);
    setSearchValue('');
    if (!userId || Number.isNaN(Number(userId))) return;
    // Navigate to profile based on current path prefix
    if (location.pathname.startsWith('/peso')) {
      navigate(`/peso/profile/${userId}`);
    } else if (location.pathname.startsWith('/ccict')) {
      navigate(`/ccict/profile/${userId}`);
    } else {
      navigate(`/alumni/profile/${userId}`);
    }
  };

  return (
    <div
      style={{
        background: '#174f84',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {/* Logo and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 'bold',
              color: '#174f84',
            }}
          >
            WNY
          </div>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>WhereNa You</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setShowSuggestions(searchResults.length > 0)}
            style={{
              borderRadius: 20,
              border: 'none',
              padding: '8px 16px 8px 40px',
              width: 300,
              fontSize: 14,
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666',
              fontSize: 16,
            }}
          >
            🔍
          </span>
          {showSuggestions && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 1000,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {searchResults.map((user) => (
                <div
                  key={user.user_id ?? user.id}
                  onClick={() => handleSearchSelect(user.user_id ?? user.id)}
                  style={{
                    padding: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <img
                    src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                    alt=""
                    style={{ width: 30, height: 30, borderRadius: '50%' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>
                      {user.course} • {user.year_graduated}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
          onClick={() => {
            const dashboardPath = isAdmin ? '/ccict/dashboard' : (isPeso ? '/peso/dashboard' : '/alumni/dashboard');
            if (location.pathname === dashboardPath) {
              const centerContent = document.querySelector('.center-content') as HTMLElement;
              if (centerContent) {
                centerContent.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            } else {
              navigate(dashboardPath);
            }
          }}
        >
          <span style={{ color: 'white', fontSize: 20 }}>🏠</span>
          <span style={{ color: 'white', fontSize: 12 }}>Home</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          <span style={{ color: 'white', fontSize: 20 }}>✉️</span>
          <span style={{ color: 'white', fontSize: 12 }}>Messages</span>
        </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          position: 'relative', // for badge positioning
        }}
        onClick={() => {
          const notifPath = isAdmin ? '/ccict/notification' : (isPeso ? '/peso/notifications' : '/alumni/notifications');
          navigate(notifPath);
        }}
      >
        <span style={{ color: 'white', fontSize: 20 }}>🔔</span>
        {notificationCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: 'red',
              color: 'white',
              borderRadius: '50%',
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 'bold',
              minWidth: 16,
              textAlign: 'center',
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {notificationCount}
          </span>
        )}
        <span style={{ color: 'white', fontSize: 12 }}>Notification</span>
      </div>
        {isAdmin && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            onClick={onTrackerClick}
          >
            <span style={{ color: 'white', fontSize: 20 }}>📋</span>
            <span style={{ color: 'white', fontSize: 12 }}>Tracker</span>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
            onClick={() => setShowProfile(!showProfile)}
          >
            <span style={{ color: 'white', fontSize: 20 }}>👤</span>
            <span style={{ color: 'white', fontSize: 12 }}>Profile ▼</span>
          </div>
          {showProfile && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 40,
                background: 'white',
                color: '#174f84',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                minWidth: 120,
                zIndex: 10,
              }}
            >
              <div style={{ padding: 12, cursor: 'pointer' }} onClick={handleLogout}>
                Logout
              </div>
              <div style={{ padding: 12, cursor: 'pointer' }} onClick={() => setShowProfile(false)}>
                Close
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlumniTopBar;
