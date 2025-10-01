import React, { useRef, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate, useLocation } from 'react-router-dom';
import ctulogo from '../../images/ctulogo.png';
import { api, getAdminPesoUsers, getUserInfo, fetchNotificationCount } from '../../services/api';
import 'primeicons/primeicons.css';

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
  const loadNotificationCount = React.useCallback(() => {
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

  React.useEffect(() => {
    loadNotificationCount();
    
    // Listen for notification read events to refresh count
    const handleNotificationRead = () => {
      loadNotificationCount();
    };
    
    window.addEventListener('notificationRead', handleNotificationRead);
    
    return () => {
      window.removeEventListener('notificationRead', handleNotificationRead);
    };
  }, [loadNotificationCount]);

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
        background: 'linear-gradient(135deg, #003366 0%, #0066cc 100%)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
      }}
    >
      {/* Logo and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: '700',
              color: '#003366',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.3s ease',
              cursor: 'pointer',
            }}
            onClick={handleHomeClick}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            WNY
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{
              borderRadius: 24,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 18px 10px 42px',
              width: 320,
              fontSize: 14,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              outline: 'none',
              transition: 'all 0.3s ease',
            }}
            onFocus={(e) => {
              setShowSuggestions(searchResults.length > 0);
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 102, 204, 0.3)';
              e.currentTarget.style.border = '1px solid rgba(0, 102, 204, 0.5)';
            }}
            onBlur={(e) => {
              setTimeout(() => setShowSuggestions(false), 200);
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            }}
          />
          <i 
            className="pi pi-search"
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666',
              fontSize: 16,
            }}
          ></i>
          {showSuggestions && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                maxHeight: 280,
                overflowY: 'auto',
                backdropFilter: 'blur(10px)',
              }}
            >
              {searchResults.map((user) => (
                <div
                  key={user.user_id ?? user.id}
                  onClick={() => handleSearchSelect(user.user_id ?? user.id)}
                  style={{
                    padding: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 102, 204, 0.05)';
                    e.currentTarget.style.paddingLeft = '16px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.paddingLeft = '12px';
                  }}
                >
                  <img
                    src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                    alt=""
                    style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(0, 102, 204, 0.2)',
                    }}
                  />
                  <div>
                    <div style={{ 
                      fontWeight: '600',
                      color: '#003366',
                      fontSize: '14px',
                    }}>{user.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '16px',
            transition: 'all 0.3s ease',
            background: location.pathname.includes('/dashboard') 
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)'
              : 'transparent',
            boxShadow: location.pathname.includes('/dashboard') 
              ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              : 'none',
            transform: location.pathname.includes('/dashboard') ? 'scale(1.05)' : 'scale(1)',
            borderBottom: location.pathname.includes('/dashboard') ? '3px solid white' : '3px solid transparent',
          }}
          onClick={handleHomeClick}
          onMouseEnter={(e) => {
            if (!location.pathname.includes('/dashboard')) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
            e.currentTarget.style.transform = location.pathname.includes('/dashboard') ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            if (!location.pathname.includes('/dashboard')) {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.transform = location.pathname.includes('/dashboard') ? 'scale(1.05)' : 'scale(1)';
          }}
        >
          <i className="pi pi-home" style={{ color: 'white', fontSize: 20 }}></i>
          <span style={{ 
            color: 'white', 
            fontSize: 12, 
            fontWeight: location.pathname.includes('/dashboard') ? '600' : '500',
            letterSpacing: '0.2px',
          }}>Home</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '16px',
            transition: 'all 0.3s ease',
            background: location.pathname.includes('/message') 
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)'
              : 'transparent',
            boxShadow: location.pathname.includes('/message') 
              ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              : 'none',
            transform: location.pathname.includes('/message') ? 'scale(1.05)' : 'scale(1)',
            borderBottom: location.pathname.includes('/message') ? '3px solid white' : '3px solid transparent',
          }}
          onClick={() => navigate('/messages')}
          onMouseEnter={(e) => {
            if (!location.pathname.includes('/message')) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
            e.currentTarget.style.transform = location.pathname.includes('/message') ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            if (!location.pathname.includes('/message')) {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.transform = location.pathname.includes('/message') ? 'scale(1.05)' : 'scale(1)';
          }}
        >
          <i className="pi pi-envelope" style={{ color: 'white', fontSize: 20 }}></i>
          <span style={{ 
            color: 'white', 
            fontSize: 12, 
            fontWeight: location.pathname.includes('/message') ? '600' : '500',
            letterSpacing: '0.2px',
          }}>Messages</span>
        </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          position: 'relative',
          padding: '10px 16px',
          borderRadius: '16px',
          transition: 'all 0.3s ease',
          background: location.pathname.includes('/notification') 
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)'
            : 'transparent',
          boxShadow: location.pathname.includes('/notification') 
            ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
            : 'none',
          transform: location.pathname.includes('/notification') ? 'scale(1.05)' : 'scale(1)',
          borderBottom: location.pathname.includes('/notification') ? '3px solid white' : '3px solid transparent',
        }}
        onClick={handleNotificationClick}
        onMouseEnter={(e) => {
          if (!location.pathname.includes('/notification')) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }
          e.currentTarget.style.transform = location.pathname.includes('/notification') ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          if (!location.pathname.includes('/notification')) {
            e.currentTarget.style.background = 'transparent';
          }
          e.currentTarget.style.transform = location.pathname.includes('/notification') ? 'scale(1.05)' : 'scale(1)';
        }}
      >
        <i className="pi pi-bell" style={{ color: 'white', fontSize: 20 }}></i>
        {notificationCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 8,
              backgroundColor: '#ff3b3b',
              color: 'white',
              borderRadius: '12px',
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: '700',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: 1.2,
              pointerEvents: 'none',
              userSelect: 'none',
              boxShadow: '0 2px 6px rgba(255, 0, 0, 0.4)',
            }}
          >
            {notificationCount}
          </span>
        )}
        <span style={{ 
          color: 'white', 
          fontSize: 12, 
          fontWeight: location.pathname.includes('/notification') ? '600' : '500',
          letterSpacing: '0.2px',
        }}>Notification</span>
      </div>
        {isAdmin && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: '16px',
              transition: 'all 0.3s ease',
              background: location.pathname.includes('/tracker') 
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%)'
                : 'transparent',
              boxShadow: location.pathname.includes('/tracker') 
                ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                : 'none',
              transform: location.pathname.includes('/tracker') ? 'scale(1.05)' : 'scale(1)',
              borderBottom: location.pathname.includes('/tracker') ? '3px solid white' : '3px solid transparent',
            }}
            onClick={handleTrackerClick}
            onMouseEnter={(e) => {
              if (!location.pathname.includes('/tracker')) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
              e.currentTarget.style.transform = location.pathname.includes('/tracker') ? 'scale(1.05) translateY(-2px)' : 'scale(1) translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!location.pathname.includes('/tracker')) {
                e.currentTarget.style.background = 'transparent';
              }
              e.currentTarget.style.transform = location.pathname.includes('/tracker') ? 'scale(1.05)' : 'scale(1)';
            }}
          >
            <i className="pi pi-clipboard" style={{ color: 'white', fontSize: 20 }}></i>
            <span style={{ 
              color: 'white', 
              fontSize: 12, 
              fontWeight: location.pathname.includes('/tracker') ? '600' : '500',
              letterSpacing: '0.2px',
            }}>Tracker</span>
          </div>
        )}
        <div style={{ position: 'relative' }} ref={profileDropdownRef}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '12px',
              transition: 'all 0.3s ease',
              background: showProfile ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
            }}
            onClick={() => setShowProfile(!showProfile)}
            onMouseEnter={(e) => {
              if (!showProfile) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              if (!showProfile) e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <i className="pi pi-user" style={{ color: 'white', fontSize: 20 }}></i>
            <span style={{ 
              color: 'white', 
              fontSize: 12, 
              fontWeight: '500',
              letterSpacing: '0.2px',
            }}>Profile ▼</span>
          </div>
          {showProfile && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 52,
                background: 'white',
                color: '#003366',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                minWidth: 140,
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <div
                style={{ 
                  padding: '14px 16px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: '500',
                  fontSize: '14px',
                }}
                onClick={() => setShowLogoutConfirm(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 102, 204, 0.08)';
                  e.currentTarget.style.paddingLeft = '20px';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.paddingLeft = '16px';
                }}
              >
                Logout
              </div>
              {!location.pathname.includes('/settings') && (
                <div 
                  style={{ 
                    padding: '14px 16px', 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: '500',
                    fontSize: '14px',
                    borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                  }} 
                  onClick={() => {
                    setShowProfile(false);
                    const settingsPath = isAdmin ? '/ccict/settings' : '/alumni/settings';
                    navigate(settingsPath);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 102, 204, 0.08)';
                    e.currentTarget.style.paddingLeft = '20px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.paddingLeft = '16px';
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
