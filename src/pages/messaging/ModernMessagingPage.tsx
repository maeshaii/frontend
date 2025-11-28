import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listConversations, ConversationSummary } from '../../services/api';
import ConversationList from './ConversationList';
import ModernChatInterface from './ModernChatInterface';
import { useLogger } from '../../utils/logger';
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
        if (!conv.other_participant || !conv.other_participant.user_id || conv.other_participant.user_id <= 0) {
          console.warn('Filtering out conversation with invalid other_participant:', conv);
          return false;
        }
        
        return true;
      });
      
      setConversations(validConversations);
      
      // Auto-select first conversation on desktop (only if valid)
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

  // Listen for conversation deletion event
  useEffect(() => {
    const handleConversationDeleted = async () => {
      // Clear selection and reload conversations
      setSelectedConversation(null);
      
      // Reload conversations directly
      try {
        setIsLoading(true);
        const data = await listConversations();
        
        // Filter out conversations with invalid data
        const validConversations = (data || []).filter(conv => {
          if (!conv.conversation_id || conv.conversation_id <= 0) return false;
          if (!conv.other_participant || !conv.other_participant.user_id || conv.other_participant.user_id <= 0) return false;
          return true;
        });
        
        setConversations(validConversations);
      } catch (error) {
        logger.error('Failed to reload conversations after deletion:', error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted);
    
    return () => {
      window.removeEventListener('conversationDeleted', handleConversationDeleted);
    };
  }, [logger]);

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

