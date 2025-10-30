/**
 * React hook for managing real-time notifications.
 * Handles WebSocket connection, notification updates, and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNotificationWebSocket, disconnectNotificationWebSocket, NotificationWsEvent, NotificationUpdate } from '../services/notificationWebSocket';
import { fetchNotifications, fetchNotificationCount } from '../services/api';
import { getUserInfo } from '../services/api';

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

  const wsRef = useRef<any>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

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
      if (data?.success && data.notifications) {
        setNotifications(data.notifications);
        
        // Update count based on unread notifications
        const unreadCount = data.notifications.filter((n: any) => !n.is_read).length;
        setNotificationCount(unreadCount);
        console.log('📊 Fetched notifications, unread count:', unreadCount);
      } else {
        setNotifications(data || []);
        setNotificationCount(0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentUserId]);

  // Fetch notification count from API
  const fetchCountData = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const data = await fetchNotificationCount(userId);
      if (data?.success && typeof data.count === 'number') {
        setNotificationCount(data.count);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  }, [getCurrentUserId]);

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
          case 'notification_update':
            setNotifications(prev => {
              const currentNotifications = Array.isArray(prev) ? prev : [];
              // Add new notification or update existing one
              const existingIndex = currentNotifications.findIndex(n => n.id === event.notification.id);
              if (existingIndex >= 0) {
                const updated = [...currentNotifications];
                updated[existingIndex] = event.notification;
                return updated;
              } else {
                // Add new notification at the beginning
                return [event.notification, ...currentNotifications];
              }
            });
            
            // Update count based on notification read status
            if (!event.notification.is_read) {
              // New unread notification - increment count
              setNotificationCount(prev => {
                const newCount = prev + 1;
                console.log('📊 New unread notification, updated count:', newCount);
                return newCount;
              });
            } else {
              // Notification marked as read - decrement count
              setNotificationCount(prev => {
                const newCount = Math.max(0, prev - 1);
                console.log('📊 Notification marked as read, updated count:', newCount);
                return newCount;
              });
            }
            break;

          case 'notification_count_update':
            setNotificationCount(event.count);
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
      // Always poll to ensure badge stays updated even if WebSocket misses events
      await Promise.all([fetchNotificationsData(), fetchCountData()]);
    }, pollingInterval);

  }, [enablePolling, pollingInterval, fetchNotificationsData, fetchCountData]);

  // Initialize
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      console.log('🚀 Initializing real-time notifications...');
      
      // Initial data fetch
      await Promise.all([fetchNotificationsData(), fetchCountData()]);

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
  }, [autoConnect, setupWebSocket, setupPolling, fetchNotificationsData, fetchCountData]);

  // Refresh when tab becomes visible
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      Promise.all([fetchNotificationsData(), fetchCountData()]);
    }
  }, [fetchNotificationsData, fetchCountData]);

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
