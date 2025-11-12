import React, { useRef, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate, useLocation } from 'react-router-dom';
import ctulogo from '../../images/ctulogo.png';
import wherenayouLogo from '../../images/logo.png';
import { api, getAdminPesoUsers, getUserInfo, fetchNotificationCount, saveRecentSearch, getRecentSearches, deleteRecentSearch } from '../../services/api';
import { RecentSearchWebSocket } from '../../services/recentSearchWebSocket';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';
import { useRealTimeMessages } from '../../hooks/useRealTimeMessages';
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
  const [recentSearches, setRecentSearches] = React.useState<any[]>([]);
  const [showRecentSearches, setShowRecentSearches] = React.useState(false);
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const recentSearchWsRef = React.useRef<RecentSearchWebSocket | null>(null);
  const isSearchFocusedRef = React.useRef(false);
  const latestSearchValueRef = React.useRef('');
  const [isCompactTopBar, setIsCompactTopBar] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1024;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsCompactTopBar(window.innerWidth <= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use real-time notifications hook
  const { notificationCount, isConnected: notificationConnected } = useRealTimeNotifications({
    enablePolling: true,
    pollingInterval: 30000,
    autoConnect: true
  });

  // Use real-time messages hook
  const { unreadCount: messageUnreadCount } = useRealTimeMessages({
    enablePolling: true,
    pollingInterval: 15000, // 15 seconds for faster badge updates
    autoConnect: true
  });
  
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

  // Real-time notifications are handled by the hook

  // Delete a recent search
  const handleDeleteRecentSearch = async (searchId: number) => {
    try {
      const response = await deleteRecentSearch(searchId);
      if (response.success) {
        // Reload recent searches to update the list
        const updatedSearches = await loadRecentSearches();
        // Keep the dropdown open if there are still recent searches
        setShowRecentSearches(updatedSearches.length > 0);
      }
    } catch (error) {
      console.error('Error deleting recent search:', error);
    }
  };

  // Load recent searches
  const buildFullName = React.useCallback((user: any) => {
    const primaryParts = [
      user?.f_name,
      user?.m_name,
      user?.l_name,
    ];

    const fallbackParts = [
      user?.first_name,
      user?.middle_name,
      user?.last_name,
    ];

    const baseParts = primaryParts.some((part) => part && String(part).trim())
      ? primaryParts
      : fallbackParts;

    const cleaned = baseParts
      .map((part) => (part ? String(part).trim() : ''))
      .filter(Boolean);

    if (cleaned.length > 0) {
      return cleaned.join(' ');
    }

    if (user?.name) {
      return String(user.name);
    }

    if (user?.full_name) {
      return String(user.full_name);
    }

    return '';
  }, []);

  const normalizeRecentSearchData = React.useCallback((detailed?: any[], legacy?: any[]) => {
    const detailedList = Array.isArray(detailed) ? detailed : [];
    const legacyList = Array.isArray(legacy) ? legacy : [];

    const idLookup = new Map<number, number>();
    detailedList.forEach((entry: any) => {
      const searchedUser = entry?.searched_user ?? {};
      const userId = Number(
        searchedUser.user_id ??
          searchedUser.id ??
          entry?.searched_user_id ??
          entry?.user_id ??
          entry?.id
      );
      const recordId = Number(entry?.id);
      if (
        Number.isFinite(userId) &&
        userId > 0 &&
        Number.isFinite(recordId) &&
        recordId > 0
      ) {
        idLookup.set(userId, recordId);
      }
    });

    const normalized = (Array.isArray(detailedList) && detailedList.length > 0 ? detailedList : legacyList)
      .map((item: any, index: number) => {
        const userData = item?.searched_user ?? item ?? {};
        const userId = Number(userData.user_id ?? userData.id ?? item?.user_id ?? item?.id);
        if (!Number.isFinite(userId) || userId <= 0) {
          return null;
        }

        const recordIdRaw = item?.id ?? item?.recent_id ?? idLookup.get(userId) ?? null;
        let recordId: number | null = null;
        if (recordIdRaw !== null && recordIdRaw !== undefined) {
          const numericId = Number(recordIdRaw);
          if (!Number.isNaN(numericId) && Number.isFinite(numericId) && numericId > 0) {
            recordId = numericId;
          }
        }

        return {
          id: recordId ?? `${userId}-${index}`,
          searched_user: {
            user_id: userId,
            f_name: userData.f_name ?? item?.f_name ?? '',
            m_name: userData.m_name ?? item?.m_name ?? '',
            l_name: userData.l_name ?? item?.l_name ?? '',
            profile_pic: userData.profile_pic ?? item?.profile_pic ?? null,
            full_name: buildFullName({
              ...userData,
              f_name: userData.f_name ?? item?.f_name ?? '',
              m_name: userData.m_name ?? item?.m_name ?? '',
              l_name: userData.l_name ?? item?.l_name ?? '',
            }),
          },
          created_at: item?.created_at ?? null,
          canDelete: recordId !== null,
        };
      })
      .filter(Boolean) as any[];

    if (process.env.NODE_ENV === 'development') {
      console.log('Normalized recent searches:', normalized);
    }
    return normalized;
  }, []);

  const loadRecentSearches = React.useCallback(async () => {
    try {
      const response = await getRecentSearches();
      const normalized = normalizeRecentSearchData(
        response?.recent_searches,
        response?.recent
      );
      setRecentSearches(normalized);
      return normalized;
    } catch (error) {
      console.error('Error loading recent searches:', error);
      setRecentSearches([]);
      return [];
    }
  }, []);

  // Preload recent searches so dropdown is ready on first focus
  React.useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  // Refresh recent searches whenever the window regains focus (e.g., user came back from mobile)
  React.useEffect(() => {
    const handleWindowFocus = () => {
      loadRecentSearches();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [loadRecentSearches]);

  // Poll while the recent searches dropdown is visible to keep in sync with other clients (e.g., mobile)
  React.useEffect(() => {
    if (!showRecentSearches) {
      return;
    }
    const interval = window.setInterval(() => {
      loadRecentSearches();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [showRecentSearches, loadRecentSearches]);

  React.useEffect(() => {
    isSearchFocusedRef.current = isSearchFocused;
  }, [isSearchFocused]);

  React.useEffect(() => {
    latestSearchValueRef.current = searchValue;
  }, [searchValue]);

  React.useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const ws = new RecentSearchWebSocket(token);
    recentSearchWsRef.current = ws;

    ws.onEvent((event) => {
      if (event.type === 'recent_search_update') {
        const normalized = normalizeRecentSearchData(
          event.recent_searches,
          event.recent
        );
        setRecentSearches(normalized);

        if (
          isSearchFocusedRef.current &&
          latestSearchValueRef.current.trim() === ''
        ) {
          setShowRecentSearches(normalized.length > 0);
        }
      }
    });

    ws.connect().catch((error) => {
      console.warn('RecentSearchWebSocket connection failed:', error);
    });

    return () => {
      ws.disconnect();
      recentSearchWsRef.current = null;
    };
  }, [normalizeRecentSearchData]);

  // Auto-toggle recent searches dropdown when focused with no query
  React.useEffect(() => {
    if (isSearchFocused && searchValue.trim() === '' && recentSearches.length > 0) {
      setShowRecentSearches(true);
    }
  }, [isSearchFocused, searchValue, recentSearches]);

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
    const handleRecentSearchUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const normalized = normalizeRecentSearchData(
        customEvent.detail?.recent_searches,
        customEvent.detail?.recent
      );
      setRecentSearches(normalized);
    };

    window.addEventListener('recentSearchUpdate', handleRecentSearchUpdate);
    return () => window.removeEventListener('recentSearchUpdate', handleRecentSearchUpdate);
  }, [normalizeRecentSearchData]);


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
                return (
                  userIdInResult !== userIdInStorage &&
                  !adminUserIds.includes(Number(userIdInResult)) &&
                  !pesoUserIds.includes(Number(userIdInResult))
                );
              });
            }

            const normalizedWithDisplayName = filteredData.map((user: any) => {
              const fName = user.f_name ?? user.first_name ?? '';
              const mName = user.m_name ?? user.middle_name ?? '';
              const lName = user.l_name ?? user.last_name ?? '';
              const displayName = buildFullName({
                f_name: fName,
                m_name: mName,
                l_name: lName,
                name: user.name,
                full_name: user.full_name,
              });

              return {
                ...user,
                displayName,
                f_name: fName,
                m_name: mName,
                l_name: lName,
              };
            });

            setSearchResults(normalizedWithDisplayName);
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


  const handleSearchSelect = async (userId: number) => {
    setShowSuggestions(false);
    setSearchValue('');
    if (!userId || Number.isNaN(Number(userId))) return;
    
    // Save the recent search
    try {
      await saveRecentSearch(userId);
    } catch (error) {
      console.error('Error saving recent search:', error);
      // Don't prevent navigation if saving fails
    }
    
    // Find the user in search results to determine account type
    const selectedUser = searchResults.find(user => (user.user_id ?? user.id) === userId);
    
    // Navigate based on account type - unified profile route
    if (selectedUser?.account_type?.peso) {
      navigate(`/peso/profile/${userId}`);
    } else if (selectedUser?.account_type?.admin) {
      navigate(`/ccict/profile/${userId}`);
    } else {
      // Unified profile route for alumni, OJT, and other users
      navigate(`/profile/${userId}`);
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
      // Unified dashboard for alumni and OJT users
      dashboardPath = `/dashboard/${userId}`;
    }
    
    // Check if we're already on the dashboard page
    const currentPath = location.pathname;
    const isAlreadyOnDashboard = currentPath.includes('/dashboard/');
    
    if (isAlreadyOnDashboard) {
      // Just scroll to top if already on dashboard
      // Find and scroll all scrollable containers
      const scrollableFeed = document.querySelector('.scrollable-feed') as HTMLElement;
      if (scrollableFeed && scrollableFeed.scrollTop > 0) {
        scrollableFeed.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Also try other possible scroll containers and scroll them all
      const selectors = ['.center-content', '.profile-center-content', '.main-content', '.page-container', '.main-content-container'];
      selectors.forEach(sel => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el && el.scrollTop > 0) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      
      // Also check for body/html scrolling
      if (document.body.scrollTop > 0) {
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (document.documentElement.scrollTop > 0) {
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Last resort: scroll window
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      // Navigate to dashboard and then scroll
      navigate(dashboardPath);
      setTimeout(() => {
        // Try scrollable-feed first (main scroll container in UnifiedDashboard)
        const scrollableFeed = document.querySelector('.scrollable-feed') as HTMLElement;
        if (scrollableFeed) {
          scrollableFeed.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        
        // Try center-content as fallback
        const centerContent = document.querySelector('.center-content') as HTMLElement;
        if (centerContent) {
          centerContent.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        
        // Fallback to other possible scroll containers
        const selectors = ['.scrollable-feed', '.center-content', '.profile-center-content', '.main-content', '.page-container', '.main-content-container'];
        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement;
          if (el) {
            el.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }
        
        // Last resort: scroll window
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
    }
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
      // Unified notifications for alumni and OJT users
      notificationPath = `/notifications`;
    }
    
    // Check if we're already on the notification page
    const currentPath = location.pathname;
    const isAlreadyOnNotification = currentPath.includes('/notification') || currentPath.includes('/notifications');
    
    if (isAlreadyOnNotification) {
      // Just scroll to top if already on notification page
      // Scroll all possible scroll containers
      const selectors = ['.scrollable-feed', '.center-content', '.profile-center-content', '.main-content', '.page-container', '.main-content-container'];
      let scrolled = false;
      selectors.forEach(sel => {
        const el = document.querySelector(sel) as HTMLElement;
        if (el && el.scrollTop > 0) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          scrolled = true;
        }
      });
      
      // Also check for body/html scrolling
      if (document.body.scrollTop > 0) {
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
        scrolled = true;
      }
      if (document.documentElement.scrollTop > 0) {
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        scrolled = true;
      }
      
      // Last resort: scroll window
      if (!scrolled && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      // Navigate to notification page
      navigate(notificationPath);
    }
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
      // Unified profile route for alumni and OJT users
      profilePath = `/profile/${userId}`;
    }
    
    navigate(profilePath);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  return (
    <div
      style={{
        background: '#174f84',
        padding: isCompactTopBar ? '12px 20px' : '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: isCompactTopBar ? 'wrap' : 'nowrap',
        gap: isCompactTopBar ? 12 : 0,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxSizing: 'border-box',
      }}
    >
      {/* Logo and Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isCompactTopBar ? 12 : 16,
          flexWrap: isCompactTopBar ? 'wrap' : 'nowrap',
          width: isCompactTopBar ? '100%' : 'auto',
          flex: isCompactTopBar ? '1 1 100%' : '0 1 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              height: 44,
              background: 'white',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              padding: '4px 8px',
            }}
          >
            <img 
              src={wherenayouLogo} 
              alt="WhereNaYou Logo" 
              style={{
                height: '100%',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            flex: isCompactTopBar ? '1 1 240px' : '0 0 auto',
            maxWidth: isCompactTopBar ? 'min(320px, 100%)' : '320px',
            width: isCompactTopBar ? '100%' : 'auto',
          }}
        >
          <input
            type="text"
            placeholder="Search users..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              // Close recent searches dropdown when user starts typing
              if (e.target.value.trim() !== '') {
                setShowRecentSearches(false);
              }
            }}
            style={{
              borderRadius: 24,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '10px 18px 10px 42px',
            width: isCompactTopBar ? '100%' : 320,
              fontSize: 14,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              outline: 'none',
              transition: 'all 0.3s ease',
            }}
            onFocus={async (e) => {
              setIsSearchFocused(true);
              if (searchValue.trim() === '') {
              const recentSearchesData = await loadRecentSearches();
              if (process.env.NODE_ENV === 'development') {
                console.log('Recent searches on focus:', recentSearchesData);
              }
              setShowRecentSearches(recentSearchesData.length > 0);
              } else {
                setShowSuggestions(searchResults.length > 0);
              }
              if (e.currentTarget) {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 102, 204, 0.3)';
                e.currentTarget.style.border = '1px solid rgba(0, 102, 204, 0.5)';
              }
            }}
            onBlur={(e) => {
              setTimeout(() => {
                setShowSuggestions(false);
                setShowRecentSearches(false);
                setIsSearchFocused(false);
              }, 200);
              if (e.currentTarget) {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)';
              }
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
                  // Use onMouseDown instead of onClick to ensure navigation before blur
                  onMouseDown={() => handleSearchSelect(user.user_id ?? user.id)}
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
                    if (e.currentTarget) {
                      e.currentTarget.style.background = 'rgba(0, 102, 204, 0.05)';
                      e.currentTarget.style.paddingLeft = '16px';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '12px';
                    }
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
                    }}>
                      {(() => {
                        if (user.displayName) return user.displayName;
                        return buildFullName({
                          f_name: user.f_name,
                          m_name: user.m_name,
                          l_name: user.l_name,
                          first_name: user.first_name,
                          middle_name: user.middle_name,
                          last_name: user.last_name,
                          name: user.name,
                          full_name: user.full_name,
                        });
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showRecentSearches && recentSearches.length > 0 && (
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
              <div style={{
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#666',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                background: 'rgba(0, 102, 204, 0.05)',
              }}>
                Recent Searches
              </div>
              {recentSearches.map((search, index) => {
                const numericId =
                  typeof search.id === 'number'
                    ? search.id
                    : Number(search.id);
                const canDelete = Number.isFinite(numericId) && numericId > 0;
                
                return (
                <div
                  key={String(search.id ?? search.searched_user?.user_id ?? index)}
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget) {
                      e.currentTarget.style.background = 'rgba(0, 102, 204, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <img
                    src={search.searched_user.profile_pic ? (String(search.searched_user.profile_pic).startsWith('http') ? search.searched_user.profile_pic : `http://127.0.0.1:8000${search.searched_user.profile_pic}`) : ctulogo}
                    alt=""
                    style={{ 
                      width: 36, 
                      height: 36, 
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(0, 102, 204, 0.2)',
                    }}
                  />
                  <div 
                    style={{ flex: 1, cursor: 'pointer' }}
                    onMouseDown={() => handleSearchSelect(search.searched_user.user_id)}
                  >
                    <div style={{ 
                      fontWeight: '600',
                      color: '#003366',
                      fontSize: '14px',
                    }}>
                      {search.searched_user.f_name} {search.searched_user.m_name} {search.searched_user.l_name}
                    </div>

                  </div>
                  <button
                    disabled={!canDelete}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canDelete) {
                        handleDeleteRecentSearch(numericId as number);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      borderRadius: '4px',
                      color: '#999',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: canDelete ? 1 : 0.4,
                      cursor: canDelete ? 'pointer' : 'not-allowed',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 0, 0, 0.1)';
                      e.currentTarget.style.color = '#ff4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#999';
                    }}
                    title={canDelete ? 'Delete this recent search' : 'Cannot delete – missing identifier'}
                  >
                    <i className="pi pi-times" style={{ fontSize: '12px' }}></i>
                  </button>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isCompactTopBar ? 16 : 24,
          flexWrap: isCompactTopBar ? 'wrap' : 'nowrap',
          justifyContent: isCompactTopBar ? 'flex-end' : 'flex-start',
          width: isCompactTopBar ? '100%' : 'auto',
          flex: isCompactTopBar ? '1 1 100%' : '0 1 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            padding: isCompactTopBar ? '8px 12px' : '10px 16px',
            borderRadius: isCompactTopBar ? '14px' : '16px',
            transition: 'all 0.3s ease',
            background: location.pathname.includes('/dashboard') 
              ? 'rgba(255, 255, 255, 0.2)'
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
            fontSize: isCompactTopBar ? 11 : 12, 
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
            padding: isCompactTopBar ? '8px 12px' : '10px 16px',
            borderRadius: isCompactTopBar ? '14px' : '16px',
            transition: 'all 0.3s ease',
            background: location.pathname.includes('/message') 
              ? 'rgba(255, 255, 255, 0.2)'
              : 'transparent',
            boxShadow: location.pathname.includes('/message') 
              ? '0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              : 'none',
            transform: location.pathname.includes('/message') ? 'scale(1.05)' : 'scale(1)',
            borderBottom: location.pathname.includes('/message') ? '3px solid white' : '3px solid transparent',
            position: 'relative',
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
          {messageUnreadCount > 0 && (
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
              {messageUnreadCount}
            </span>
          )}
          <span style={{ 
            color: 'white', 
            fontSize: isCompactTopBar ? 11 : 12, 
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
          padding: isCompactTopBar ? '8px 12px' : '10px 16px',
          borderRadius: isCompactTopBar ? '14px' : '16px',
          transition: 'all 0.3s ease',
          background: location.pathname.includes('/notification') 
            ? 'rgba(255, 255, 255, 0.2)'
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
              right: isCompactTopBar ? 6 : 8,
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
        {/* WebSocket connection indicator */}
        {/* <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            backgroundColor: '#4CAF50',
            borderRadius: '50%',
            border: '2px solid white',
            pointerEvents: 'none'
          }} title="Real-time notifications connected" /> */}
        <span style={{ 
          color: 'white', 
          fontSize: isCompactTopBar ? 11 : 12, 
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
              padding: isCompactTopBar ? '8px 12px' : '10px 16px',
              borderRadius: isCompactTopBar ? '14px' : '16px',
              transition: 'all 0.3s ease',
              background: location.pathname.includes('/tracker') 
                ? 'rgba(255, 255, 255, 0.2)'
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
              fontSize: isCompactTopBar ? 11 : 12, 
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
              padding: isCompactTopBar ? '6px 10px' : '8px 12px',
              borderRadius: isCompactTopBar ? '10px' : '12px',
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
            <i className="pi pi-bars" style={{ 
              color: 'white', 
              fontSize: 20, 
              display: 'inline-block',
              minWidth: '20px',
              minHeight: '20px',
              lineHeight: '1',
              fontFamily: 'primeicons'
            }}></i>
            <span style={{ 
              color: 'white', 
              fontSize: isCompactTopBar ? 11 : 12, 
              fontWeight: '500',
              letterSpacing: '0.2px',
            }}>Menu ▼</span>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
                <i className="pi pi-sign-out" style={{ fontSize: '16px', color: '#e74c3c' }}></i>
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }} 
                  onClick={() => {
                    setShowProfile(false);
                    let settingsPath = '/settings';
                    if (isAdmin) {
                      settingsPath = '/ccict/settings';
                    } else if (isPeso) {
                      settingsPath = '/peso/settings';
                    }
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
                  <i className="pi pi-cog" style={{ fontSize: '16px', color: '#3498db' }}></i>
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
