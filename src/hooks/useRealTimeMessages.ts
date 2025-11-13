/**
 * React hook for managing real-time message unread counts.
 * Handles WebSocket connection for message updates and polling fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listConversations } from '../services/api';
import { getConversationWsUrl } from '../services/api';

interface UseRealTimeMessagesOptions {
  enablePolling?: boolean;
  pollingInterval?: number;
  autoConnect?: boolean;
}

interface UseRealTimeMessagesReturn {
  unreadCount: number;
  totalConversations: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  refreshMessages: () => Promise<void>;
}

export function useRealTimeMessages(
  options: UseRealTimeMessagesOptions = {}
): UseRealTimeMessagesReturn {
  const {
    enablePolling = true,
    pollingInterval = 15000, // 15 seconds for faster updates
    autoConnect = true
  } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  // Calculate unread count from conversations - count unique conversations with unread messages (people who messaged)
  const calculateUnreadCount = useCallback((conversations: any[]) => {
    // Count how many people (conversations) have unread messages
    const peopleWithUnread = conversations.filter((conv) => {
      return (conv.unread_count || 0) > 0;
    }).length;
    setUnreadCount(peopleWithUnread);
    setTotalConversations(conversations.length);
    console.log('📨 Updated message unread count:', peopleWithUnread, 'people with unread messages from', conversations.length, 'conversations');
  }, []);

  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const conversations = await listConversations();
      calculateUnreadCount(conversations || []);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [calculateUnreadCount]);

  // Setup WebSocket connection for real-time updates
  const setupWebSocket = useCallback(() => {
    try {
      // Fetch conversations first to get list
      fetchConversations().then(() => {
        // For now, we'll rely on polling since message WebSocket is per-conversation
        // We can enhance this later to subscribe to all conversations
        setIsConnected(true);
      });
    } catch (error) {
      console.error('Error setting up message WebSocket:', error);
      setError('Failed to connect to message updates');
    }
  }, [fetchConversations]);

  // Setup polling as fallback/primary method
  const setupPolling = useCallback(() => {
    if (!enablePolling) return;

    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Fetch immediately
    fetchConversations();

    // Set up interval with shorter interval for faster updates
    pollingIntervalRef.current = window.setInterval(() => {
      fetchConversations();
    }, pollingInterval);
    
    // Also refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchConversations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, pollingInterval, fetchConversations]);

  // Initialize
  useEffect(() => {
    if (!autoConnect || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Fetch immediately on mount
    fetchConversations();
    
    // Setup WebSocket if available
    if (autoConnect) {
      setupWebSocket();
    }
    
    // Setup polling as fallback
    setupPolling();

    return () => {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsConnected(false);
    };
  }, [autoConnect, setupWebSocket, setupPolling, fetchConversations]);

  // Listen for conversation updates from other components
  useEffect(() => {
    const handleConversationUpdate = (e?: Event) => {
      // If event has detail with conversations, use it directly
      if (e && (e as CustomEvent).detail) {
        const conversations = (e as CustomEvent).detail;
        if (Array.isArray(conversations)) {
          calculateUnreadCount(conversations);
          return;
        }
      }
      // Otherwise refresh from API
      fetchConversations();
    };

    window.addEventListener('conversationRead', handleConversationUpdate as EventListener);
    window.addEventListener('newMessage', handleConversationUpdate as EventListener);
    window.addEventListener('conversationsUpdated', handleConversationUpdate as EventListener);

    return () => {
      window.removeEventListener('conversationRead', handleConversationUpdate as EventListener);
      window.removeEventListener('newMessage', handleConversationUpdate as EventListener);
      window.removeEventListener('conversationsUpdated', handleConversationUpdate as EventListener);
    };
  }, [fetchConversations, calculateUnreadCount]);

  return {
    unreadCount,
    totalConversations,
    isConnected,
    isLoading,
    error,
    refreshMessages: fetchConversations
  };
}

