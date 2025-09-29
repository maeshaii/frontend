import React, { useRef, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate, useLocation } from 'react-router-dom';
import ctulogo from '../../images/ctulogo.png';
import { api, getAdminPesoUsers, getUserInfo, fetchNotificationCount } from '../../services/api';

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
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const [searchValue, setSearchValue] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // New state for notification count
  const [notificationCount, setNotificationCount] = React.useState(0);
  
  // State for admin and PESO user IDs
  const [adminUserIds, setAdminUserIds] = React.useState<number[]>([]);
  const [pesoUserIds, setPesoUserIds] = React.useState<number[]>([]);

  React.useEffect(() => {
    // Fetch admin and PESO user IDs
    const fetchAdminPesoUsers = async () => {
      try {
        const response = await getAdminPesoUsers();
        if (response.success) {
          setAdminUserIds(response.admin_user_ids || []);
          setPesoUserIds(response.peso_user_ids || []);
        }
      } catch (error) {
        console.error('Error fetching admin/PESO users:', error);
      }
    };

    fetchAdminPesoUsers();
  }, []);

  // Fetch notification count
  React.useEffect(() => {
    const user = getUserInfo();
    if (!user || !(user.user_id || user.id)) {
      setNotificationCount(0);
      return;
    }
    const uid = Number(user.user_id || user.id);
    fetchNotificationCount(uid)
      .then((data) => {
        if (data && typeof data.count === 'number') {
          setNotificationCount(data.count);
        } else {
          setNotificationCount(0);
        }
      })
      .catch(() => {
        setNotificationCount(0);
      });
  }, []);

  // Handle click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };

    if (showProfile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfile, setShowProfile]);

  // Listen for user data updates from Settings
  React.useEffect(() => {
    const handleUserDataUpdate = (event: CustomEvent) => {
      console.log('User data updated event received in AlumniTopBar:', event.detail);
      // No specific action needed here as AlumniTopBar doesn't display user profile data
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    };
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
                // Exclude current user, admin accounts, and PESO accounts by ID
                return userIdInResult !== userIdInStorage && 
                       !adminUserIds.includes(Number(userIdInResult)) && 
                       !pesoUserIds.includes(Number(userIdInResult));
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
  }, [searchValue])


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

  // Refactored admin URLs
  const getAdminUrl = (path: string) => `/ccict/${path}`;

  // Default tracker click for admin
  const handleTrackerClick = onTrackerClick || (() => {
    if (isAdmin) {
      navigate('/tracker/questions');
    }
  });

  // Refactored navigation for admin
  const handleHomeClick = () => {
    const user = getUserInfo();
    const userId = user?.user_id || user?.id;
    
    if (!userId) return;
    
    let dashboardPath = '';
    if (isAdmin) {
      dashboardPath = `/ccict/dashboard/${userId}`;
    } else if (isPeso) {
      dashboardPath = `/peso/dashboard/${userId}`;
    } else {
      // Check if user is OJT or alumni based on user data
      const userRole = user?.role || user?.user_type;
      if (userRole === 'ojt' || userRole === 'coordinator') {
        dashboardPath = `/ojt/dashboard/${userId}`;
      } else {
        dashboardPath = `/alumni/dashboard/${userId}`;
      }
    }
    
    navigate(dashboardPath);
    setTimeout(() => {
      const selectors = ['.center-content', '.profile-center-content', '.main-content'];
      let scrolled = false;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          scrolled = true;
        }
      }
      if (!scrolled) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 200);
  };

  const handleNotificationClick = () => {
    const user = getUserInfo();
    const userId = user?.user_id || user?.id;
    
    if (!userId) return;
    
    let notificationPath = '';
    if (isAdmin) {
      notificationPath = `/ccict/notification`;
    } else if (isPeso) {
      notificationPath = `/peso/notifications/`;
    } else {
      // Check if user is OJT or alumni based on user data
      const userRole = user?.role || user?.user_type;
      if (userRole === 'ojt' || userRole === 'coordinator') {
        notificationPath = `/ojt/notifications/`;
      } else {
        notificationPath = `/alumni/notifications/`;
      }
    }
    
    navigate(notificationPath);
  };

  const handleProfileClick = () => {
    const user = getUserInfo();
    const userId = user?.user_id || user?.id;
    
    if (!userId) return;
    
    let profilePath = '';
    if (isAdmin) {
      profilePath = `/ccict/profile/${userId}`;
    } else if (isPeso) {
      profilePath = `/peso/profile/${userId}`;
    } else {
      // Check if user is OJT or alumni based on user data
      const userRole = user?.role || user?.user_type;
      if (userRole === 'ojt' || userRole === 'coordinator') {
        profilePath = `/ojt/profile/${userId}`;
      } else {
        profilePath = `/alumni/profile/${userId}`;
      }
    }
    
    navigate(profilePath);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

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
          onClick={handleHomeClick}
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
          onClick={() => navigate('/messages')}
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
        onClick={handleNotificationClick}
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
            onClick={handleTrackerClick}
          >
            <span style={{ color: 'white', fontSize: 20 }}>📋</span>
            <span style={{ color: 'white', fontSize: 12 }}>Tracker</span>
          </div>
        )}
        <div style={{ position: 'relative' }} ref={profileDropdownRef}>
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
                zIndex: 1000,
              }}
            >
              <div
                style={{ padding: 12, cursor: 'pointer' }}
                onClick={() => setShowLogoutConfirm(true)}
              >
                Logout
              </div>
              {!location.pathname.includes('/settings') && (
                <div 
                  style={{ padding: 12, cursor: 'pointer' }} 
                  onClick={() => {
                    setShowProfile(false);
                    const settingsPath = isAdmin ? '/ccict/settings' : '/alumni/settings';
                    navigate(settingsPath);
                  }}
                >
                  Settings
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Yes"
        cancelText="Cancel"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default AlumniTopBar;
