/**
 * React hook for managing real-time notifications.
 * Handles WebSocket connection, notification updates, and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNotificationWebSocket, disconnectNotificationWebSocket, NotificationWsEvent, NotificationUpdate } from '../services/notificationWebSocket';
import { fetchNotifications, markNotificationAsRead, getUserInfo } from '../services/api';

interface UseRealTimeNotificationsOptions {
  enablePolling?: boolean;
  pollingInterval?: number;
  autoConnect?: boolean;
}

interface UseRealTimeNotificationsReturn {
  notifications: NotificationUpdate[];
  notificationCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  refreshCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useRealTimeNotifications(
  options: UseRealTimeNotificationsOptions = {}
): UseRealTimeNotificationsReturn {
  const {
    enablePolling = true,
    pollingInterval = 30000, // 30 seconds
    autoConnect = true
  } = options;

  const [notifications, setNotifications] = useState<NotificationUpdate[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminUser] = useState<boolean>(() => {
    const user = getUserInfo();
    const accountType = user?.account_type || {};
    return Boolean(
      accountType?.admin ||
      accountType?.peso ||
      accountType?.staff ||
      accountType?.coordinator ||
      accountType?.super_admin
    );
  });

  const wsRef = useRef<any>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const popupNotificationIdsRef = useRef<Set<number>>(new Set());
  const autoMarkedNotificationIdsRef = useRef<Set<number>>(new Set());

const isRewardNotification = (notification?: NotificationUpdate) => {
  if (!notification) return false;
  const type = (notification.type || '').toLowerCase();
  const subject = (notification.subject || '').toLowerCase();
  const content = (notification.content || '').toLowerCase();
  return type.includes('reward') || subject.includes('reward') || content.includes('reward');
};

const extractRewardRequestId = (notification?: NotificationUpdate) => {
  if (!notification) return null;
  const contentMatch = notification.content?.match(/<!--REQUEST_ID:(\d+)-->/i);
  if (contentMatch && contentMatch[1]) {
    const parsed = Number(contentMatch[1]);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const subjectMatch = notification.subject?.match(/REQUEST_ID:(\d+)/i);
  if (subjectMatch && subjectMatch[1]) {
    const parsed = Number(subjectMatch[1]);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const deriveRewardStatusFromNotification = (notification?: NotificationUpdate) => {
  if (!notification) return undefined;
  const text = `${notification.subject || ''} ${notification.content || ''}`.toLowerCase();
  if (text.includes('ready') && text.includes('pickup')) return 'ready_for_pickup';
  if (text.includes('approved')) return 'approved';
  if (text.includes('claimed') || text.includes('released')) return 'claimed';
  if (text.includes('pending')) return 'pending';
  return undefined;
};

const shouldShowAsPopup = useCallback((notification: NotificationUpdate) => {
    if (!isAdminUser) return false;
    if (!notification) return false;
    const type = (notification.type || '').toLowerCase();
    const subject = (notification.subject || '').toLowerCase();
    const content = (notification.content || '').toLowerCase();

    if (type.includes('tracker') || subject.includes('tracker') || content.includes('tracker')) {
      return true;
    }

    if (type.includes('reward') || subject.includes('reward') || content.includes('reward')) {
      return true;
    }

    return false;
  }, [isAdminUser]);

  const dispatchPopupNotification = useCallback((notification: NotificationUpdate) => {
    window.dispatchEvent(new CustomEvent('popupNotification', { detail: { notification } }));
  }, []);

  const markHiddenNotificationAsRead = useCallback((notification: NotificationUpdate) => {
    if (!isAdminUser) return;
    if (!notification || notification.is_read) return;
    if (autoMarkedNotificationIdsRef.current.has(notification.id)) return;

    autoMarkedNotificationIdsRef.current.add(notification.id);
    markNotificationAsRead(notification.id).catch((err) => {
      console.error('Error auto-marking hidden notification as read:', err);
      autoMarkedNotificationIdsRef.current.delete(notification.id);
    });
  }, [isAdminUser]);

  // Get current user info
  const getCurrentUserId = useCallback(() => {
    const user = getUserInfo();
    return user?.user_id || user?.id;
  }, []);

  // Fetch notifications from API
  const fetchNotificationsData = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchNotifications(userId);
      if (data?.success && Array.isArray(data.notifications)) {
        const rawNotifications = data.notifications as NotificationUpdate[];
        const filteredNotifications = rawNotifications.filter((notification) => {
          if (shouldShowAsPopup(notification)) {
            popupNotificationIdsRef.current.add(notification.id);
            markHiddenNotificationAsRead(notification);
            return false;
          }
          return true;
        });

        setNotifications(filteredNotifications);

        const unreadCount = filteredNotifications.filter((n) => !n.is_read).length;
        setNotificationCount(unreadCount);
        console.log('📊 Fetched notifications (filtered), unread count:', unreadCount);
      } else {
        setNotifications([]);
        setNotificationCount(0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentUserId, markHiddenNotificationAsRead, shouldShowAsPopup]);

  // Fetch notification count from API
  const fetchCountData = useCallback(async () => {
    await fetchNotificationsData();
  }, [fetchNotificationsData]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      // Update local state immediately for better UX
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      
      // Update count
      setNotificationCount(prev => {
        const newCount = Math.max(0, prev - 1);
        console.log('📊 Marked as read, updated count:', newCount);
        return newCount;
      });
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('notificationRead', { 
        detail: { notificationId } 
      }));
      
      // TODO: Call API to mark as read
      // await markNotificationAsRead(notificationId);
      
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotificationCount(0);
      
      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('allNotificationsRead'));
      
      // TODO: Call API to mark all as read
      // await markAllNotificationsAsRead(getCurrentUserId());
      
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    await fetchNotificationsData();
  }, [fetchNotificationsData]);

  // Refresh count
  const refreshCount = useCallback(async () => {
    await fetchCountData();
  }, [fetchCountData]);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('🔌 Setting up WebSocket with token:', token ? 'Present' : 'Missing');
      console.log('🔌 Token value:', token ? token.substring(0, 20) + '...' : 'null');
      
      if (!token) {
        console.warn('⚠️ No access token found! WebSocket will not connect.');
        // Don't set error for missing token - just skip WebSocket
        return;
      }
      
      const ws = getNotificationWebSocket(token || undefined);
      wsRef.current = ws;

      // Handle connection status
      ws.onStatus((status) => {
        setIsConnected(status === 'connected');
        if (status === 'error') {
          // Only log error, don't display to user - fallback to polling is available
          console.warn('WebSocket connection failed, will use polling fallback');
        }
      });

      // Handle notification updates
      ws.onEvent((event: NotificationWsEvent) => {
        console.log('useRealTimeNotifications received event:', event);
        switch (event.type) {
          case 'notification_update': {
            const notification = event.notification;

            if (isRewardNotification(notification)) {
              const requestId = extractRewardRequestId(notification);
              const derivedStatus = deriveRewardStatusFromNotification(notification);
              try {
                localStorage.setItem('latestRewardRequestUpdate', JSON.stringify({
                  requestId,
                  status: derivedStatus,
                  timestamp: Date.now()
                }));
              } catch (error) {
                console.warn('Failed writing reward request update to localStorage:', error);
              }
              window.dispatchEvent(new CustomEvent('rewardRequestUpdated', {
                detail: {
                  requestId,
                  status: derivedStatus,
                  source: 'realtime_notification',
                  notification
                }
              }));
            }

            if (shouldShowAsPopup(notification)) {
              const alreadyHandled = popupNotificationIdsRef.current.has(notification.id);
              popupNotificationIdsRef.current.add(notification.id);

              if (!alreadyHandled) {
                dispatchPopupNotification(notification);
              }

              markHiddenNotificationAsRead(notification);

              setNotifications(prev => {
                const currentNotifications = Array.isArray(prev) ? prev : [];
                const filtered = currentNotifications.filter(n => n.id !== notification.id);
                const unreadCount = filtered.filter(n => !n.is_read).length;
                setNotificationCount(unreadCount);
                return filtered;
              });
              break;
            }

            setNotifications(prev => {
              const currentNotifications = Array.isArray(prev) ? prev : [];
              const existingIndex = currentNotifications.findIndex(n => n.id === notification.id);
              let updated: NotificationUpdate[];
              if (existingIndex >= 0) {
                updated = [...currentNotifications];
                updated[existingIndex] = notification;
              } else {
                updated = [notification, ...currentNotifications];
              }
              const unreadCount = updated.filter(n => !n.is_read).length;
              setNotificationCount(unreadCount);
              return updated;
            });
            break;
          }

          case 'notification_count_update':
            void fetchNotificationsData();
            break;

          case 'recent_search_update':
            window.dispatchEvent(new CustomEvent('recentSearchUpdate', {
              detail: {
                recent_searches: event.recent_searches ?? [],
                recent: event.recent ?? []
              }
            }));
            break;

          case 'connection_established':
            console.log('Notification WebSocket connected');
            setError(null);
            break;

          case 'connection_denied':
            console.warn('Notification WebSocket connection denied:', event.message);
            // Don't set error - polling will handle it
            setIsConnected(false);
            break;

          case 'error':
            console.warn('Notification WebSocket error:', event.message);
            // Don't set error - polling will handle it
            setIsConnected(false);
            break;
        }
      });

      // Connect WebSocket
      console.log('🚀 Attempting to connect WebSocket...');
      ws.connect().catch((err) => {
        // Silently handle WebSocket connection failures - polling fallback will work
        console.warn('⚠️ WebSocket connection failed, will use polling fallback:', err.message);
        setIsConnected(false);
        // Don't set error state - user doesn't need to know about WebSocket issues
      });

    } catch (err) {
      // Handle errors gracefully - polling will handle notifications
      console.warn('Error setting up notification WebSocket (will use polling):', err);
      setIsConnected(false);
    }
  }, []);

  // Setup polling fallback
  const setupPolling = useCallback(() => {
    if (!enablePolling) return;

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Setup new interval
    pollingIntervalRef.current = window.setInterval(async () => {
      await fetchNotificationsData();
    }, pollingInterval);

  }, [enablePolling, pollingInterval, fetchNotificationsData]);

  // Refresh when tab becomes visible
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      fetchNotificationsData();
    }
  }, [fetchNotificationsData]);

  // Initialize
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      console.log('🚀 Initializing real-time notifications...');
      
      // Initial data fetch (also updates count)
      await fetchNotificationsData();

      // Setup WebSocket if auto-connect is enabled
      if (autoConnect) {
        console.log('🔌 Auto-connect enabled, setting up WebSocket...');
        setupWebSocket();
      } else {
        console.log('⚠️ Auto-connect disabled, WebSocket not connecting');
      }

      // Setup polling fallback
      setupPolling();
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoConnect, setupWebSocket, setupPolling, fetchNotificationsData, handleVisibilityChange]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleVisibilityChange]);

  // Listen for custom events from other components
  useEffect(() => {
    const handleNotificationRead = () => {
      refreshCount();
    };

    const handleAllNotificationsRead = () => {
      setNotificationCount(0);
    };

    window.addEventListener('notificationRead', handleNotificationRead);
    window.addEventListener('allNotificationsRead', handleAllNotificationsRead);

    return () => {
      window.removeEventListener('notificationRead', handleNotificationRead);
      window.removeEventListener('allNotificationsRead', handleAllNotificationsRead);
    };
  }, [refreshCount]);

  return {
    notifications,
    notificationCount,
    isConnected,
    isLoading,
    error,
    refreshNotifications,
    refreshCount,
    markAsRead,
    markAllAsRead
  };
}
