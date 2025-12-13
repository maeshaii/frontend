import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listConversations, ConversationSummary } from '../../services/api';
import ConversationList from './ConversationList';
import ModernChatInterface from './ModernChatInterface';
import { useLogger } from '../../utils/logger';
import { getNotificationWebSocket } from '../../services/notificationWebSocket';
import './Messaging.css';

const ModernMessagingPage: React.FC = () => {
  const logger = useLogger('ModernMessagingPage');
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setShowSidebar(!selectedConversation);
      } else {
        setShowSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [selectedConversation]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listConversations();
      
      // CRITICAL: Filter out conversations with invalid data
      const validConversations = (data || []).filter(conv => {
        // Must have valid conversation_id
        if (!conv.conversation_id || conv.conversation_id <= 0) {
          console.warn('Filtering out conversation with invalid conversation_id:', conv);
          return false;
        }
        
        // Must have valid other_participant with valid user_id
        // EXCEPTION: Allow conversations without other_participant if they have messages
        // This handles the case where the other user deleted the conversation but it still exists for this user
        if (!conv.other_participant || !conv.other_participant.user_id || conv.other_participant.user_id <= 0) {
          // If conversation has messages, keep it (other user deleted but conversation still exists)
          if (conv.last_message && conv.last_message.content) {
            logger.info('Keeping conversation without other_participant (has messages):', {
              conversation_id: conv.conversation_id
            });
            return true;
          }
          console.warn('Filtering out conversation with invalid other_participant:', conv);
          return false;
        }
        
        return true;
      });
      
      setConversations(validConversations);
      
      // Clear selected conversation if it no longer exists in the list
      setSelectedConversation(prev => {
        if (prev && !validConversations.some(c => c.conversation_id === prev.conversation_id)) {
          logger.info('🔵 [LOAD] Selected conversation no longer exists, clearing selection');
          return null;
        }
        return prev;
      });
      
      // Auto-select first conversation on desktop (only if valid and no selection)
      if (!isMobile && validConversations && validConversations.length > 0 && !selectedConversation) {
        setSelectedConversation(validConversations[0]);
      }
    } catch (error) {
      logger.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isMobile, selectedConversation, logger]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
        logger.error('Failed to refresh conversations:', error);
      }
    };
    window.addEventListener('newMessage', messageHandler as EventListener);
    
    // Periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(async () => {
      try {
        const data = await listConversations();
        setConversations(data || []);
      } catch (error) {
        logger.error('Failed to refresh conversations:', error);
      }
    }, 30000);
    
    return () => {
      window.removeEventListener('conversationsUpdated', handler as EventListener);
      window.removeEventListener('newMessage', messageHandler as EventListener);
      clearInterval(refreshInterval);
    };
  }, [logger]);

  // Listen for conversation deletion event (from local UI actions)
  useEffect(() => {
    const handleConversationDeleted = async (e?: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const conversationId = detail.conversation_id;
      const fullyDeleted = detail.fully_deleted;
      
      logger.info('🔵 [WEB EVENT] conversationDeleted event received:', {
        conversation_id: conversationId,
        fully_deleted: fullyDeleted,
        current_conversations_count: conversations.length
      });
      
      // Clear selection only if the deleted conversation is currently selected
      setSelectedConversation(prev => {
        if (prev?.conversation_id === conversationId) {
          logger.info('🔵 [WEB EVENT] Clearing selected conversation (matches deleted conversation)');
          return null;
        }
        return prev;
      });
      
      // Reload conversations directly
      try {
        logger.info('🔵 [WEB EVENT] Reloading conversations from API...');
        setIsLoading(true);
        const data = await listConversations();
        
        logger.info('🔵 [WEB EVENT] API returned conversations:', {
          total_count: data?.length || 0,
          conversations: data?.map((c: any) => ({
            id: c.conversation_id,
            other_user_id: c.other_participant?.user_id,
            other_user_name: c.other_participant?.name
          }))
        });
        
        // Filter out conversations with invalid data
        const validConversations = (data || []).filter(conv => {
          if (!conv.conversation_id || conv.conversation_id <= 0) {
            logger.warn('🔵 [WEB EVENT] Filtering out conversation with invalid conversation_id:', conv);
            return false;
          }
          if (!conv.other_participant || !conv.other_participant.user_id || conv.other_participant.user_id <= 0) {
            logger.warn('🔵 [WEB EVENT] Filtering out conversation with invalid other_participant:', {
              conversation_id: conv.conversation_id,
              other_participant: conv.other_participant
            });
            return false;
          }
          return true;
        });
        
        logger.info('🔵 [WEB EVENT] Valid conversations after filtering:', {
          valid_count: validConversations.length,
          filtered_out: (data?.length || 0) - validConversations.length,
          valid_ids: validConversations.map((c: any) => c.conversation_id)
        });
        
        setConversations(validConversations);
        
        // Clear selected conversation if it no longer exists in the list
        setSelectedConversation(prev => {
          if (prev && !validConversations.some(c => c.conversation_id === prev.conversation_id)) {
            logger.info('🔵 [WEB EVENT] Selected conversation no longer exists, clearing selection');
            return null;
          }
          return prev;
        });
        
        logger.info('🔵 [WEB EVENT] Conversations reloaded and state updated');
      } catch (error) {
        logger.error('🔵 [WEB EVENT] ERROR - Failed to reload conversations after deletion:', error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted as EventListener);
    
    return () => {
      window.removeEventListener('conversationDeleted', handleConversationDeleted as EventListener);
    };
  }, [logger, conversations.length]);

  // Setup WebSocket listener for real-time conversation deletion events (from other devices/platforms)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const ws = getNotificationWebSocket(token);
    
    const handleWebSocketEvent = (event: any) => {
      if (event.type === 'conversation_deleted') {
        logger.info(`🔵 [WEB WEBSOCKET] Conversation deleted event received:`, {
          conversation_id: event.conversation_id,
          fully_deleted: event.fully_deleted,
          timestamp: event.timestamp || new Date().toISOString()
        });
        
        const currentConversationsCount = conversations.length;
        const conversationExists = conversations.some(c => c.conversation_id === event.conversation_id);
        
        logger.info(`🔵 [WEB WEBSOCKET] Current state:`, {
          conversations_count: currentConversationsCount,
          conversation_exists_in_list: conversationExists
        });
        
        // CRITICAL FIX: Only remove from UI if conversation was fully deleted
        // If fully_deleted is false, the conversation still exists for other participants
        if (event.fully_deleted === true) {
          logger.info(`🔵 [WEB WEBSOCKET] Conversation fully deleted - removing from UI`);
          // Conversation was fully deleted - remove from UI
          setSelectedConversation(prev => {
            if (prev?.conversation_id === event.conversation_id) {
              logger.info(`🔵 [WEB WEBSOCKET] Clearing selected conversation`);
              return null;
            }
            return prev;
          });
          
          // Remove from local state immediately
          setConversations(prev => {
            const filtered = prev.filter(c => c.conversation_id !== event.conversation_id);
            logger.info(`🔵 [WEB WEBSOCKET] Removed from local state:`, {
              before_count: prev.length,
              after_count: filtered.length
            });
            return filtered;
          });
        } else {
          // Conversation still exists for other participants - just reload
          logger.info(`🔵 [WEB WEBSOCKET] Conversation NOT fully deleted - keeping in UI, will reload`);
          logger.info(`🔵 [WEB WEBSOCKET] This means other participants still have access to this conversation`);
        }
        
        // Always reload conversations to ensure consistency
        logger.info(`🔵 [WEB WEBSOCKET] Reloading conversations from API...`);
        loadConversations();
        
        // Also dispatch custom event for consistency with local deletions
        window.dispatchEvent(new CustomEvent('conversationDeleted', { 
          detail: { conversation_id: event.conversation_id, fully_deleted: event.fully_deleted } 
        }));
        logger.info(`🔵 [WEB WEBSOCKET] Dispatched conversationDeleted custom event`);
      }
    };

    ws.onEvent(handleWebSocketEvent);
    
    ws.connect().catch(error => {
      logger.warn('Failed to connect notification WebSocket for conversation deletion updates:', error);
    });

    return () => {
      // Note: Don't disconnect the global WebSocket as it might be used by other components
      // Just remove our event handler - the onEvent will keep the callback in the array
      // This is fine as the callback will check the event type and only act on conversation_deleted
    };
  }, [logger]); // Include logger for consistency

  const handleConversationSelect = useCallback((conversation: ConversationSummary | null) => {
    setSelectedConversation(conversation);
    
    // On mobile, hide sidebar when conversation is selected (only if conversation is valid)
    if (isMobile && conversation) {
      setShowSidebar(false);
    }
  }, [isMobile]);

  const handleBackToConversations = useCallback(() => {
    if (isMobile) {
      setShowSidebar(true);
      setSelectedConversation(null);
    }
  }, [isMobile]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleNewMessage = useCallback(() => {
    // Navigate to new message page or open new message modal
    navigate('/messaging/new');
  }, [navigate]);

  // Check authentication
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  return (
    <div className="messaging-page">
      {/* Mobile Header */}
      {isMobile && selectedConversation && (
        <div className="mobile-header">
          <button 
            className="mobile-back-btn"
            onClick={handleBackToConversations}
          >
            ←
          </button>
          <div className="mobile-header-info">
            <h2 className="mobile-header-name">
              {selectedConversation.other_participant?.name || 'Unknown User'}
            </h2>
            <span className="mobile-header-status">Online</span>
          </div>
          <div className="mobile-header-actions">
            <button className="mobile-header-btn">📞</button>
            <button className="mobile-header-btn">📹</button>
            <button className="mobile-header-btn">⋯</button>
          </div>
        </div>
      )}

      <div className="messaging-container">
        {/* Sidebar */}
        {showSidebar && (
          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.conversation_id}
            onConversationSelect={handleConversationSelect}
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
        {selectedConversation ? (
          <ModernChatInterface
            conversation={selectedConversation}
            onBack={isMobile ? handleBackToConversations : undefined}
          />
        ) : (
          <div className="no-conversation-selected">
            <div className="no-conversation-content">
              <div className="no-conversation-icon">💬</div>
              <h2 className="no-conversation-title">Welcome to Messaging</h2>
              <p className="no-conversation-message">
                {isMobile 
                  ? 'Select a conversation to start messaging'
                  : 'Select a conversation from the sidebar to start messaging'
                }
              </p>
              <button 
                className="new-message-btn"
                onClick={handleNewMessage}
              >
                Start New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <button 
          className="floating-action-btn"
          onClick={handleNewMessage}
          title="New Message"
        >
          ✏️
        </button>
      )}
    </div>
  );
};

export default ModernMessagingPage;

