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
      setConversations(data || []);
      
      // Auto-select first conversation on desktop
      if (!isMobile && data && data.length > 0 && !selectedConversation) {
        setSelectedConversation(data[0]);
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

  const handleConversationSelect = useCallback((conversation: ConversationSummary) => {
    setSelectedConversation(conversation);
    
    // On mobile, hide sidebar when conversation is selected
    if (isMobile) {
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

