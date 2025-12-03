import React, { useEffect, useState, useCallback } from 'react';
import { ConversationSummary, listConversations } from '../../services/api';
import AlumniTopBar from '../alumni/AlumniTopBar';
import ConversationList from './ConversationList';
import ModernChatInterface from './ModernChatInterface';
import UserSearch from './UserSearch';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { getNotificationWebSocket } from '../../services/notificationWebSocket';
import './Messaging.css';
import './ErrorFallback.css';

const Messaging: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-select conversation if conversation_id is provided in query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convoId = params.get('conversation_id');
    if (convoId) {
      // create a minimal placeholder selection so ChatInterface mounts immediately
      setSelectedConversation({
        conversation_id: Number(convoId),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        last_message: null,
        other_participant: null,
      } as ConversationSummary);

      // Fetch full conversation details to replace placeholder (populate name/avatar)
      listConversations()
        .then((list) => {
          const found = (list || []).find((c) => c.conversation_id === Number(convoId));
          if (found) setSelectedConversation(found);
        })
        .catch(() => {});
    }
  }, []);

  // Load conversations function
  const loadConversations = useCallback(async () => {
      try {
        console.log('🔵 [WEB LOAD] Loading conversations from API...');
        setIsLoading(true);
        const data = await listConversations();
        
        console.log('🔵 [WEB LOAD] API returned conversations:', {
          total_count: data?.length || 0,
          conversations: data?.map((c: any) => ({
            id: c.conversation_id,
            other_user_id: c.other_participant?.user_id,
            other_user_name: c.other_participant?.name,
            unread_count: c.unread_count
          }))
        });
        
        // CRITICAL: Filter out conversations with invalid data
        const validConversations = (data || []).filter(conv => {
          // Must have valid conversation_id
          if (!conv.conversation_id || conv.conversation_id <= 0) {
            console.warn('🔵 [WEB LOAD] Filtering out conversation with invalid conversation_id:', conv);
            return false;
          }
          
          // Must have valid other_participant with valid user_id
          // EXCEPTION: Allow conversations without other_participant if they have messages
          // This handles the case where the other user deleted the conversation but it still exists for this user
          if (!conv.other_participant || !conv.other_participant.user_id || conv.other_participant.user_id <= 0) {
            // If conversation has messages, keep it (other user deleted but conversation still exists)
            if (conv.last_message && conv.last_message.content) {
              console.log('🔵 [WEB LOAD] Keeping conversation without other_participant (has messages):', {
                conversation_id: conv.conversation_id,
                has_last_message: !!conv.last_message
              });
              return true;
            }
            console.warn('🔵 [WEB LOAD] Filtering out conversation with invalid other_participant:', {
              conversation_id: conv.conversation_id,
              other_participant: conv.other_participant
            });
            return false;
          }
          
          return true;
        });
        
        console.log('🔵 [WEB LOAD] Valid conversations after filtering:', {
          valid_count: validConversations.length,
          filtered_out: (data?.length || 0) - validConversations.length,
          valid_ids: validConversations.map((c: any) => c.conversation_id)
        });
        
        setConversations(validConversations);
        // Emit event to update badge in top bar
        // CRITICAL FIX: Defer event dispatch to avoid state updates during render
        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('conversationsUpdated', { detail: validConversations }));
        }, 0);
        console.log('🔵 [WEB LOAD] Conversations loaded and state updated');
      } catch (error) {
        console.error('🔵 [WEB LOAD] ERROR - Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Listen for conversation deletion event (from local UI actions)
  useEffect(() => {
    const handleConversationDeleted = async () => {
      // Clear selection and reload conversations
      setSelectedConversation(null);
      await loadConversations();
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted);
    
    return () => {
      window.removeEventListener('conversationDeleted', handleConversationDeleted);
    };
  }, []); // Empty deps - use function closure

  // Setup WebSocket listener for real-time conversation deletion events (from other devices/platforms)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const ws = getNotificationWebSocket(token);
    
    const handleWebSocketEvent = (event: any) => {
      if (event.type === 'conversation_deleted') {
        console.log('🔵 [WEB WEBSOCKET] Conversation deleted event received:', {
          conversation_id: event.conversation_id,
          fully_deleted: event.fully_deleted,
          timestamp: event.timestamp || new Date().toISOString()
        });
        
        const currentConversationsCount = conversations.length;
        const conversationExists = conversations.some(c => c.conversation_id === event.conversation_id);
        
        console.log('🔵 [WEB WEBSOCKET] Current state:', {
          conversations_count: currentConversationsCount,
          conversation_exists_in_list: conversationExists
        });
        
        // CRITICAL FIX: Only remove from UI if conversation was fully deleted
        // If fully_deleted is false, the conversation still exists for other participants
        // We should reload to get updated data, but not remove it immediately
        if (event.fully_deleted === true) {
          console.log('🔵 [WEB WEBSOCKET] Conversation fully deleted - removing from UI');
          // Conversation was fully deleted - remove from UI
          setSelectedConversation(prev => {
            if (prev?.conversation_id === event.conversation_id) {
              console.log('🔵 [WEB WEBSOCKET] Clearing selected conversation');
              return null;
            }
            return prev;
          });
          
          // Remove from local state immediately
          setConversations(prev => {
            const filtered = prev.filter(c => c.conversation_id !== event.conversation_id);
            console.log('🔵 [WEB WEBSOCKET] Removed from local state:', {
              before_count: prev.length,
              after_count: filtered.length
            });
            return filtered;
          });
        } else {
          // Conversation still exists for other participants
          // Just reload to get updated conversation list (user was removed from participants)
          // Don't remove from UI - let the reload handle it
          console.log('🔵 [WEB WEBSOCKET] Conversation NOT fully deleted - keeping in UI, will reload');
          console.log('🔵 [WEB WEBSOCKET] This means other participants still have access to this conversation');
        }
        
        // Always reload conversations to ensure consistency
        console.log('🔵 [WEB WEBSOCKET] Reloading conversations from API...');
        loadConversations();
        
        // Also dispatch custom event for consistency with local deletions
        window.dispatchEvent(new CustomEvent('conversationDeleted', { 
          detail: { conversation_id: event.conversation_id, fully_deleted: event.fully_deleted } 
        }));
        console.log('🔵 [WEB WEBSOCKET] Dispatched conversationDeleted custom event');
      }
    };

    ws.onEvent(handleWebSocketEvent);
    
    ws.connect().catch(error => {
      console.warn('Failed to connect notification WebSocket for conversation deletion updates:', error);
    });

    return () => {
      // Note: Don't disconnect the global WebSocket as it might be used by other components
      // Just remove our event handler - the onEvent will keep the callback in the array
      // This is fine as the callback will check the event type and only act on conversation_deleted
    };
  }, [loadConversations]); // Include loadConversations in deps

  // Listen for read events from the chat view to zero-out unread in sidebar instantly
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const conversationId: number | undefined = detail.conversationId;
      if (!conversationId) return;
      setConversations(prev => {
        const updated = prev.map(c => 
          c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c
        );
        // Emit event to update badge in top bar
        window.dispatchEvent(new CustomEvent('conversationsUpdated', { detail: updated }));
        return updated;
      });
    };
    window.addEventListener('conversationRead', handler as EventListener);
    return () => window.removeEventListener('conversationRead', handler as EventListener);
  }, []);

  // Listen for real-time conversation updates (new messages, message requests, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail)) {
        setConversations(detail);
      }
    };
    window.addEventListener('conversationsUpdated', handler as EventListener);
    
    // Also listen for new messages to refresh conversations
    const messageHandler = async () => {
      try {
        const data = await listConversations();
        setConversations(data || []);
      } catch (error) {
        console.error('Failed to refresh conversations:', error);
      }
    };
    window.addEventListener('newMessage', messageHandler as EventListener);
    
    // Periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(async () => {
      try {
        const data = await listConversations();
        setConversations(data || []);
      } catch (error) {
        console.error('Failed to refresh conversations:', error);
      }
    }, 30000);
    
    return () => {
      window.removeEventListener('conversationsUpdated', handler as EventListener);
      window.removeEventListener('newMessage', messageHandler as EventListener);
      clearInterval(refreshInterval);
    };
  }, []);

  const handleSelectConversation = (conversation: ConversationSummary | null) => {
    setSelectedConversation(conversation);
    
    // Only update unread count if conversation is valid
    if (conversation && conversation.conversation_id) {
      // Optimistically clear unread count in the sidebar when opening a conversation
      setConversations(prev => {
        const updated = prev.map(c => 
          c.conversation_id === conversation.conversation_id 
            ? { ...c, unread_count: 0 } 
            : c
        );
        // Emit event to update badge in top bar
        window.dispatchEvent(new CustomEvent('conversationsUpdated', { detail: updated }));
        return updated;
      });
    }
    
    if (isMobile) {
      // On mobile, we might want to hide the conversation list
      // and show only the chat interface
    }
  };

  const handleConversationCreated = async (conversation: ConversationSummary) => {
    setSelectedConversation(conversation);
    setShowUserSearch(false);
    // Refresh conversations list to include new conversation
    try {
      const data = await listConversations();
      setConversations(data || []);
      // Emit event to update badge in top bar
      window.dispatchEvent(new CustomEvent('conversationsUpdated', { detail: data || [] }));
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
  };

  const handleSearchChange = (query: string) => {
    // Handle search functionality
    console.log('Search query:', query);
  };

  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  // Determine user type from localStorage
  const [userType, setUserType] = useState<{ isAdmin: boolean; isPeso: boolean }>({ isAdmin: false, isPeso: false });
  
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const accountType = user?.account_type || {};
        setUserType({
          isAdmin: !!(accountType.admin || accountType.ccict),
          isPeso: !!accountType.peso
        });
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }, []);

	return (
		<div className="messaging-page">
      {/* Global Top Bar */}
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={userType.isAdmin}
        isPeso={userType.isPeso}
      />

			<div className="messaging-container">
        {/* Left Sidebar - Conversations */}
        {(!isMobile || !selectedConversation) && (
          <ConversationList
            conversations={conversations}
            onConversationSelect={handleSelectConversation}
            selectedConversationId={selectedConversation?.conversation_id}
            onSearchChange={handleSearchChange}
            isLoading={isLoading}
            onConversationDeleted={async () => {
              // Clear selection first
              setSelectedConversation(null);
              
              // Reload conversations after deletion
              await loadConversations();
            }}
          />
        )}
        
        {/* Main Chat Area */}
        {(!isMobile || selectedConversation) && (
          <ErrorBoundary
            fallback={
              <div className="error-fallback">
                <h3>Something went wrong with the chat</h3>
                <p>Please refresh the page to try again.</p>
                <button onClick={() => window.location.reload()}>
                  Refresh Page
                </button>
              </div>
            }
          >
            <ModernChatInterface
              conversation={selectedConversation}
              onBack={isMobile ? handleBackToConversations : undefined}
            />
          </ErrorBoundary>
        )}


        {/* Welcome Message for Desktop */}
        {!selectedConversation && !isMobile && (
          <div className="no-conversation-selected">
            <div className="no-conversation-content">
              <div className="no-conversation-icon">💬</div>
              <h2 className="no-conversation-title">Welcome to Messages</h2>
              <p className="no-conversation-message">
                Select a conversation from the sidebar to start messaging
              </p>
              <button 
                onClick={() => setShowUserSearch(true)}
                className="new-message-btn"
              >
                Start New Conversation
              </button>
            </div>
          </div>
        )}
			</div>

      {showUserSearch && (
        <UserSearch
          onConversationCreated={handleConversationCreated}
          onClose={() => setShowUserSearch(false)}
        />
      )}
    </div>
  );
};

export default Messaging;