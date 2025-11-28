import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FaBars,
  FaTimes, 
  FaChartLine, 
  FaChartBar, 
  FaUsers, 
  FaCog, 
  FaUser, 
  FaClipboard, 
  FaEnvelope, 
  FaStar, 
  FaSignOutAlt
} from 'react-icons/fa';
import { MdSettingsSuggest } from 'react-icons/md';
import whereNaYouLogo from '../../../images/final_logos-removebg-preview.png';
import ConfirmModal from '../../../components/ConfirmModal';
import './sidebar.css';
import { getRewardRequests } from '../../../services/api';
import { useRealTimeNotifications } from '../../../hooks/useRealTimeNotifications';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const notificationPendingIdsRef = useRef<Set<number>>(new Set());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Responsive state - initialize based on current window width
  const initialWidth = window.innerWidth;
  const initialSmall = initialWidth < 768;
  const initialDesktop = initialWidth >= 1280;
  const STORAGE_KEY = 'adminSidebarMobileOpen';
  // On small screens, read persisted open state so it doesn't auto-close on navigation
  const readPersistedOpen = () => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  };
  // On small screens, sidebar starts based on persisted preference; otherwise closed
  // CRITICAL: On small screens, ALWAYS start collapsed (icon-only). On medium, start collapsed. On desktop, start expanded.
  const [isCollapsed, setIsCollapsed] = useState(initialSmall ? true : (!initialDesktop ? true : false)); 
  const [isMobileSmall, setIsMobileSmall] = useState(initialSmall); // off-canvas mode
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(initialDesktop);
  const [pendingRequests, setPendingRequests] = useState<number>(() => {
    try { return Number(localStorage.getItem('coordinatorReqCount')) || 0; } catch { return 0; }
  });
  const [pendingRewardRequests, setPendingRewardRequests] = useState<number>(() => {
    try { return Number(localStorage.getItem('rewardReqCount')) || 0; } catch { return 0; }
  });
  const { notifications: realtimeNotifications } = useRealTimeNotifications({
    enablePolling: true,
    pollingInterval: 60000,
    autoConnect: true
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateRewardRequestCount = React.useCallback(async () => {
    try {
      const response = await getRewardRequests();
      if (!isMountedRef.current) return;

      if (response?.success && Array.isArray(response.requests)) {
        const pendingRequests = response.requests.filter((req: any) => {
          const status = (req?.status || '').toString().toLowerCase();
          return status === 'pending';
        });

        const pendingCount = pendingRequests.length;

        notificationPendingIdsRef.current = new Set(
          pendingRequests
            .map((req: any) => Number(req?.request_id))
            .filter((id: number) => !Number.isNaN(id))
        );

        setPendingRewardRequests(pendingCount);
        try {
          localStorage.setItem('rewardReqCount', String(pendingCount));
          window.dispatchEvent(new CustomEvent('rewardRequestCountUpdated'));
        } catch {}
      }
    } catch (error) {
      console.error('Error updating reward request count:', error);
    }
  }, []);

  useEffect(() => {
    updateRewardRequestCount();
  }, [updateRewardRequestCount]);

  useEffect(() => {
    const handleRealtimeNotifications = () => {
      const latestPending = realtimeNotifications.filter((notif: any) => {
        const type = (notif?.type || '').toString().toLowerCase();
        return type.includes('reward') && type.includes('request') && !notif.is_read;
      }).length;

      if (latestPending !== pendingRewardRequests) {
        updateRewardRequestCount();
      }
    };

    handleRealtimeNotifications();
  }, [realtimeNotifications, pendingRewardRequests, updateRewardRequestCount]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'coordinatorReqCount') {
        setPendingRequests(Number(e.newValue) || 0);
      }
      if (e.key === 'rewardReqCount') {
        setPendingRewardRequests(Number(e.newValue) || 0);
      }
    };
    window.addEventListener('storage', onStorage);
    // Initialize once
    try { setPendingRequests(Number(localStorage.getItem('coordinatorReqCount')) || 0); } catch {}
    try { setPendingRewardRequests(Number(localStorage.getItem('rewardReqCount')) || 0); } catch {}
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const handleCoordinatorRequestCountUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number }>;
      if (typeof customEvent.detail?.count === 'number') {
        setPendingRequests(customEvent.detail.count);
        return;
      }
      try {
        setPendingRequests(Number(localStorage.getItem('coordinatorReqCount')) || 0);
      } catch {
        setPendingRequests(0);
      }
    };

    window.addEventListener('coordinatorRequestCountUpdated', handleCoordinatorRequestCountUpdated);
    return () => {
      window.removeEventListener('coordinatorRequestCountUpdated', handleCoordinatorRequestCountUpdated);
    };
  }, []);

  // Also listen for custom events from other tabs/windows
  const handleRewardSignal = React.useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ notification?: any }>;
    const notification = customEvent.detail?.notification;

    let fallbackCount = Math.max(notificationPendingIdsRef.current.size, 1);

    if (notification) {
      const requestIdMatch =
        notification.content?.match(/<!--REQUEST_ID:(\d+)-->/) ||
        notification.subject?.match(/REQUEST_ID:(\d+)/i);

      if (requestIdMatch && requestIdMatch[1]) {
        const requestId = Number(requestIdMatch[1]);
        if (!Number.isNaN(requestId)) {
          notificationPendingIdsRef.current.add(requestId);
        }
      }

      fallbackCount = Math.max(notificationPendingIdsRef.current.size, fallbackCount);
    }

    setPendingRewardRequests(prev => {
      const next = Math.max(prev, fallbackCount);
      try {
        localStorage.setItem('rewardReqCount', String(next));
        window.dispatchEvent(new CustomEvent('rewardRequestCountUpdated'));
      } catch {}
      return next;
    });

    setTimeout(() => {
      updateRewardRequestCount();
    }, 700);
  }, [updateRewardRequestCount]);

  useEffect(() => {
    const handleRewardRequestUpdate = () => {
      try {
        const count = Number(localStorage.getItem('rewardReqCount')) || 0;
        setPendingRewardRequests(count);
      } catch {}
    };
    
    // Listen for custom events
    window.addEventListener('rewardRequestCountUpdated', handleRewardRequestUpdate);
    window.addEventListener('rewardRequestNotificationReceived', handleRewardSignal as EventListener);
    window.addEventListener('rewardRequestUpdated', updateRewardRequestCount as EventListener);
    
    // Also check localStorage periodically for same-tab updates
    const interval = setInterval(() => {
      try {
        const count = Number(localStorage.getItem('rewardReqCount')) || 0;
        if (count !== pendingRewardRequests) {
          setPendingRewardRequests(count);
        }
      } catch {}
    }, 2000); // Check every 2 seconds
    
    return () => {
      window.removeEventListener('rewardRequestCountUpdated', handleRewardRequestUpdate);
      window.removeEventListener('rewardRequestNotificationReceived', handleRewardSignal as EventListener);
      window.removeEventListener('rewardRequestUpdated', updateRewardRequestCount as EventListener);
      clearInterval(interval);
    };
  }, [pendingRewardRequests, updateRewardRequestCount, handleRewardSignal]);
  // On small screens, start CLOSED (hamburger state)
  const [mobileOpen, setMobileOpen] = useState(initialSmall ? false : false);
  // Use ref to persist mobileOpen state across route changes
  const mobileOpenRef = useRef(false);
  const prevScreenSizeRef = useRef({ isSmall: initialSmall, isDesktop: initialDesktop });
  // Ref to lock collapsed state on small screens - prevents Dashboard/Statistics from expanding
  const smallScreenLockRef = useRef(initialSmall);
  
  // Sync ref with state
  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  // CRITICAL: On small screens, NEVER allow isCollapsed to be false - force it to true always
  // This prevents Dashboard/Statistics routes from expanding the sidebar
  useEffect(() => {
    // Update ref whenever screen size changes
      smallScreenLockRef.current = isMobileSmall;
    
    // If on small screen and somehow collapsed is false, force it to true immediately
    if (isMobileSmall && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [isMobileSmall, isCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < 768;
      const desktop = window.innerWidth >= 1280;
      const prevSmall = prevScreenSizeRef.current.isSmall;
      
      setIsMobileSmall(small);
      setIsDesktopExpanded(desktop);
      prevScreenSizeRef.current = { isSmall: small, isDesktop: desktop };

      if (small) {
        setIsCollapsed(true); // icons only when visible
        // Force hamburger state when entering small screens
        setMobileOpen(false);
        mobileOpenRef.current = false;
      } else if (!desktop) {
        setIsCollapsed(true); // tablet collapsed (icons only)
      } else {
        setIsCollapsed(false); // full labels only on larger screens
      }

      // Update CSS var for content margin
      const sidebarWidthVar = small ? '0px' : (desktop ? '240px' : '70px');
      document.documentElement.style.setProperty('--sidebar-width', sidebarWidthVar);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Preserve mobileOpen state across route changes - keep sidebar open if it was open
  // Use useLayoutEffect to run synchronously before paint, ensuring state is set immediately
  useLayoutEffect(() => {
    // On route change, keep icon-only lock on small but DO NOT change open/closed state
    const isOnSmallScreen = isMobileSmall || smallScreenLockRef.current;
    if (isOnSmallScreen) {
      setIsCollapsed(true);
      smallScreenLockRef.current = true;
      mobileOpenRef.current = mobileOpen;
    }
  }, [location.pathname, isMobileSmall, mobileOpen]);

  const toggleMobile = () => {
    setMobileOpen((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  const closeSidebarOnMobile = () => {
    if (isMobileSmall) {
      setMobileOpen(false);
      try { localStorage.setItem(STORAGE_KEY, 'false'); } catch {}
    }
  };

  const sidebarWidth = isMobileSmall ? (mobileOpen ? '70px' : '0px') : (isCollapsed ? '70px' : '240px');
  const isHidden = isMobileSmall && !mobileOpen;

  const styles = {
    sidebar: {
      width: sidebarWidth,
      height: '100vh',
      backgroundColor: '#1C4E80',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
      color: '#ffffff',
      padding: '20px 10px',
      position: 'fixed' as const,
      top: 0,
      left: isHidden ? '-220px' : '0',
      zIndex: 1000,
      transition: 'all 0.3s ease',
      borderRight: '1px solid #e5e7eb',
      boxShadow: isCollapsed && !isMobileSmall ? 'none' : '2px 0 8px rgba(0, 0, 0, 0.1)',
    },
    hamburgerButton: {
      position: 'fixed' as const,
      top: '20px',
      left: '20px',
      zIndex: 3000,
      backgroundColor: '#1C4E80',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '10px',
      padding: '10px 12px',
      cursor: 'pointer',
      display: isMobileSmall ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff'
    },
    topSection: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    logo: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      marginBottom: '60px',
      opacity: 1,
      transition: 'opacity 0.3s ease',
      overflow: 'hidden',
      whiteSpace: 'nowrap' as const,
      gap: '10px',
    },
    logoContainer: {
      width: '100%',
      maxWidth: isCollapsed ? '60px' : '220px',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isCollapsed ? '0' : '6px',
      overflow: 'visible' as const,
      padding: isCollapsed ? '6px' : '12px 8px',
      transition: 'all 0.3s ease',
      flexWrap: 'nowrap' as const,
    },
    logoIcon: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: isCollapsed ? '32px' : '40px',
      height: isCollapsed ? '32px' : '40px',
      minWidth: isCollapsed ? '32px' : '40px',
      minHeight: isCollapsed ? '32px' : '40px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative' as const,
    },
    logoIconImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain' as const,
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      userSelect: 'none' as const,
      pointerEvents: 'none' as const,
      display: 'block',
    },
    logoImage: {
      display: 'none', // Hidden - replaced with text logo
    },
    logoText: {
      fontSize: isCollapsed ? '18px' : '24px',
      textAlign: 'left' as const,
      fontWeight: '700' as const,
      color: '#ffffff',
      fontFamily: '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: isCollapsed ? '0.5px' : '0.8px',
      textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      overflow: 'visible' as const,
      transition: 'all 0.3s ease',
      whiteSpace: 'nowrap' as const,
      opacity: isCollapsed ? 0 : 1,
      width: isCollapsed ? '0' : 'auto',
      flexShrink: 0,
      lineHeight: '1.2',
    },
    navList: {
      listStyleType: 'none' as const,
      padding: 0,
      margin: 0,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      margin: '8px 0',
      cursor: 'pointer',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      textDecoration: 'none',
      color: '#ffffff',
      // On small screens, always center (icon-only). On larger screens, center if collapsed
      justifyContent: (isMobileSmall || isCollapsed) ? 'center' : 'flex-start',
      position: 'relative' as const,
    },
    activeNavItem: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      color: '#ffffff',
    },
    navItemHover: {
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    icon: {
      // On small screens, no margin. On larger screens, no margin if collapsed
      marginRight: (isMobileSmall || isCollapsed) ? '0' : '12px',
      fontSize: '18px',
      color: 'currentColor',
      flexShrink: 0,
      transition: 'margin 0.3s ease',
    },
    navItemText: {
      // On small screens, hide text. On larger screens, hide text if collapsed
      opacity: (isMobileSmall || isCollapsed) ? 0 : 1,
      width: (isMobileSmall || isCollapsed) ? '0' : 'auto',
      overflow: 'hidden',
      whiteSpace: 'nowrap' as const,
      transition: 'opacity 0.3s ease',
    },
    tooltip: {
      position: 'absolute' as const,
      left: '100%',
      marginLeft: '10px',
      backgroundColor: '#0f2f5f',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '14px',
      whiteSpace: 'nowrap' as const,
      opacity: (isCollapsed || isMobileSmall) ? 1 : 0,
      pointerEvents: ((isCollapsed || isMobileSmall) ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
      transition: 'opacity 0.2s ease',
      zIndex: 1002,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      visibility: (isCollapsed || isMobileSmall) ? 'visible' as const : 'hidden' as const,
    },
    logout: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      cursor: 'pointer',
      textDecoration: 'none',
      color: '#ffffff',
      marginBottom: '24px',
      borderRadius: '8px',
      transition: 'all 0.3s ease',
      justifyContent: (isCollapsed && !isMobileSmall) ? 'center' : 'flex-start',
      position: 'relative' as const,
    },
    requestsBadge: {
      position: 'absolute' as const,
      right: 10,
      top: 8,
      background: '#ef4444',
      color: 'white',
      borderRadius: 9999,
      fontSize: 9,
      padding: '1px 5px',
      display: (isMobileSmall || isCollapsed) ? 'none' : 'inline-block',
      zIndex: 1000,
      fontWeight: 'bold' as const,
      minWidth: '16px',
      textAlign: 'center' as const,
      lineHeight: '1.3',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    },
    requestsDot: {
      position: 'absolute' as const,
      right: 16,
      top: 12,
      width: 6,
      height: 6,
      background: '#ef4444',
      borderRadius: '50%',
      display: (isMobileSmall || isCollapsed) ? 'inline-block' : 'none',
      zIndex: 1000,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    },
  };

  const getIcon = (path: string) => {
    // Normalize dynamic paths to their base route for icon resolution
    const basePath = path.startsWith('/ccict/dashboard') ? '/ccict/dashboard' : path;
    switch (basePath) {
      case '/dashboard': return <FaChartLine style={styles.icon} />;
      case '/statistics': return <FaChartBar style={styles.icon} />;
      case '/users':
      case '/ViewStats': return <FaUsers style={styles.icon} />;
      case '/user-management': return <FaCog style={styles.icon} />;
      case '/ccict/profile':
      case '/ccict/dashboard': return <FaUser style={styles.icon} />;
      case '/tracker':
      case '/tracker/questions': return <FaClipboard style={styles.icon} />;
      case '/requests': return <FaEnvelope style={styles.icon} />;
      case '/rewards': return <FaStar style={styles.icon} />;
      case '/report-settings': return <MdSettingsSuggest style={styles.icon} />;
      default: return null;
    }
  };

  // Build dynamic profile link with user ID if available
  const getStoredUserId = (): string | null => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed: any = JSON.parse(raw);
      const id = parsed?.id ?? parsed?.user_id ?? parsed?.user?.id ?? parsed?.user?.user_id ?? null;
      return id != null ? String(id) : null;
    } catch {
      return null;
    }
  };

  const profileLink = (() => {
    const id = getStoredUserId();
    return id ? `/ccict/dashboard/${id}` : '/ccict/dashboard';
  })();

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/statistics', label: 'Statistics' },
    { to: '/user-management', label: 'User Management' },
    { to: '/ViewStats', label: 'Alumni Users', childRoutes: ['/AlumniData'] },
    { to: profileLink, label: 'Profile' },
    { to: '/tracker/questions', label: 'Tracker' },
    { to: '/requests', label: 'Coordinator Requests' },
    { to: '/rewards', label: 'Reward Requests' },
    { to: '/report-settings', label: 'Header/Footer Settings' },
  ];

  // Check if a link is active (either exact match or starts with, or is a child route)
  const isActive = (link: { to: string; childRoutes?: string[] }) => {
    const currentPath = location.pathname;
    // Exact match
    if (currentPath === link.to) return true;
    // Starts with (for sub-routes like /tracker/questions)
    if (currentPath.startsWith(link.to + '/')) return true;
    // Child routes (like /ViewStats for /statistics)
    if (link.childRoutes && link.childRoutes.some(child => currentPath === child || currentPath.startsWith(child))) return true;
    return false;
  };

  return (
    <>
      {/* Mobile hamburger */}
      {isMobileSmall && (
        <button
          type="button"
          aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
          style={styles.hamburgerButton}
          onClick={toggleMobile}
        >
          {mobileOpen ? <FaTimes /> : <FaBars />}
        </button>
      )}

      {isMobileSmall && mobileOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            // Only close if clicking directly on overlay backdrop
            // Check that the click target is the overlay div itself, not any child
            const target = e.target as HTMLElement;
            const overlay = e.currentTarget as HTMLElement;
            
            // Make absolutely sure we're clicking the overlay, not the sidebar
            if (target === overlay || target.parentElement === overlay) {
              // Additional check: ensure sidebar container is not in the path
              const sidebarContainer = document.querySelector('[data-sidebar-container]');
              if (!sidebarContainer || !sidebarContainer.contains(target)) {
                closeSidebarOnMobile();
              }
            }
          }}
        />
      )}

      <div 
        data-sidebar-container
        style={{
          ...styles.sidebar,
          pointerEvents: 'auto' as const, // Ensure sidebar can receive clicks
        }}
        onClick={(e) => {
          // Prevent clicks inside sidebar from bubbling to overlay
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          // Stop propagation on mousedown as well (before click event)
          e.stopPropagation();
        }}
      >
        <div style={styles.topSection}>
          <div style={styles.logo}>
            <div style={styles.logoContainer}>
              <div style={styles.logoIcon}>
                <img 
                  src={whereNaYouLogo} 
                  alt="WhereNaYou Logo" 
                  style={styles.logoIconImage}
                  onError={(e) => {
                    // Graceful fallback: hide image if it fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.warn('WhereNaYou logo failed to load');
                  }}
                  loading="eager"
                  decoding="async"
                />
              </div>
              <h1 style={styles.logoText}>{isCollapsed ? 'WNY' : 'WhereNaYou'}</h1>
            </div>
          </div>

          <ul style={styles.navList}>
            {links.map((link) => {
              const active = isActive(link);
              const isRequests = link.to === '/requests';
              const isRewards = link.to === '/rewards';
              return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  style={{
                    ...styles.navItem,
                    ...(active ? styles.activeNavItem : {}),
                  }}
                  title={(isCollapsed || isMobileSmall) ? link.label : undefined}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    // Prevent sidebar from closing on mobile when clicking links
                    e.stopPropagation();
                    // Persist open state IMMEDIATELY before navigation happens
                    if (isMobileSmall || smallScreenLockRef.current) {
                      // CRITICAL: Force icon-only mode - NEVER allow expansion on small screens
                      // Use both state and ref check to ensure it's locked
                      setIsCollapsed(true);
                      mobileOpenRef.current = true;
                      setMobileOpen(true);
                      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.10)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {getIcon(link.to)}
                  {/* Only show inline text when expanded (desktop). Never show on small screens. */}
                  {!isCollapsed && !isMobileSmall && (
                    <span style={styles.navItemText}>{link.label}</span>
                  )}
                  {/* Show badge on Requests link whenever there are pending requests, regardless of current page */}
                  {isRequests && pendingRequests > 0 && (
                    <>
                      <span style={styles.requestsBadge}>{pendingRequests}</span>
                      <span style={styles.requestsDot} />
                    </>
                  )}
                  {/* Show badge on Rewards link whenever there are pending reward requests, regardless of current page */}
                  {isRewards && pendingRewardRequests > 0 && (
                    <>
                      <span style={styles.requestsBadge}>{pendingRewardRequests}</span>
                      <span style={styles.requestsDot} />
                    </>
                  )}
                </Link>
              </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          style={{ ...styles.logout, background: 'transparent', border: 'none', width: '100%', textAlign: 'left' as const }}
          onClick={() => setShowLogoutConfirm(true)}
          title={(isCollapsed || isMobileSmall) ? 'Logout' : undefined}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.10)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <FaSignOutAlt style={styles.icon} />
          {!isCollapsed && !isMobileSmall && (
            <span style={styles.navItemText}>Logout</span>
          )}
        </button>

        <ConfirmModal
          open={showLogoutConfirm}
          title="Log out"
          message="Are you sure you want to log out?"
          confirmText="Yes"
          cancelText="Cancel"
          onConfirm={() => {
            setShowLogoutConfirm(false);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            sessionStorage.removeItem('userManagementVerified');
            navigate('/login');
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      </div>
    </>
  );
};

export default Sidebar;

