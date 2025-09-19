import React, { useState } from 'react';
import { ConversationSummary } from '../../services/api';
import AlumniTopBar from '../alumni/AlumniTopBar';
import ConversationList from './ConversationList';
import ChatInterface from './ChatInterface';
import UserSearch from './UserSearch';
import './Messaging.css';

const Messaging: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectConversation = (conversation: ConversationSummary) => {
    setSelectedConversation(conversation);
    if (isMobile) {
      // On mobile, we might want to hide the conversation list
      // and show only the chat interface
    }
  };

  const handleConversationCreated = (conversation: ConversationSummary) => {
    setSelectedConversation(conversation);
    setShowUserSearch(false);
  };

  const handleBackToConversations = () => {
    setSelectedConversation(null);
  };

  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  return (
    <div className="messaging-page">
      {/* Global Top Bar (matches the second image) */}
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />
      {/* Top Bar */}
      <div className="messaging-top-bar">
        <div className="top-bar-left">
          <h1 className="messaging-title">Messaging</h1>
        </div>
        <div className="top-bar-center">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search messages"
              className="search-input"
            />
          </div>
        </div>
        <div className="top-bar-right">
          <button className="new-message-btn" onClick={() => setShowUserSearch(true)}>
            ✏️
          </button>
          <div className="unread-dropdown">
            <button className="unread-btn">Unread ▼</button>
          </div>
        </div>
      </div>

      <div className="messaging-container">
        {(!isMobile || !selectedConversation) && (
          <ConversationList
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversation?.conversation_id}
          />
        )}
        
        {(!isMobile || selectedConversation) && (
          <ChatInterface
            conversation={selectedConversation}
            onBack={isMobile ? handleBackToConversations : undefined}
          />
        )}

        {!selectedConversation && !isMobile && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h2>Welcome to Messages</h2>
              <p>Select a conversation from the list to start messaging, or start a new conversation.</p>
              <button 
                onClick={() => setShowUserSearch(true)}
                className="start-conversation-button"
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
