import React, { useEffect, useState, useCallback } from 'react';
import { ConversationSummary, listConversations } from '../../services/api';
import './Messaging.css';

interface ConversationListProps {
  onSelectConversation: (conversation: ConversationSummary) => void;
  selectedConversationId?: number;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  onSelectConversation, 
  selectedConversationId 
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations();
      setConversations(data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading && conversations.length === 0) {
    return (
      <div className="conversation-list">
        <div className="conversation-list-header">
          <h2>Messages</h2>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversation-list">
        <div className="conversation-list-header">
          <h2>Messages</h2>
        </div>
        <div className="error-container">
          <p>{error}</p>
          <button onClick={loadConversations} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Messages</h2>
        <button 
          onClick={loadConversations} 
          className="refresh-button"
          title="Refresh conversations"
        >
          ↻
        </button>
      </div>
      
      <div className="conversation-list-content">
        {conversations.length === 0 ? (
          <div className="empty-state">
            <p>No conversations yet</p>
            <p className="empty-state-subtitle">Start a conversation with someone!</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.conversation_id}
              className={`conversation-item ${
                selectedConversationId === conversation.conversation_id ? 'selected' : ''
              }`}
              onClick={() => onSelectConversation(conversation)}
            >
              <div className="conversation-avatar">
                <div className="avatar-placeholder">
                  {conversation.other_participant?.name?.charAt(0) || '?'}
                </div>
                {conversation.unread_count > 0 && (
                  <div className="unread-badge">
                    {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                  </div>
                )}
              </div>
              
              <div className="conversation-content">
                <div className="conversation-header">
                  <h3 className="conversation-name">
                    {conversation.other_participant?.name || 'Unknown User'}
                  </h3>
                  <span className="conversation-time">
                    {conversation.last_message ? formatTime(conversation.last_message.created_at) : ''}
                  </span>
                </div>
                
                <div className="conversation-preview">
                  <p className={`conversation-message ${conversation.unread_count > 0 ? 'unread' : ''}`}>
                    {conversation.last_message 
                      ? truncateMessage(conversation.last_message.content)
                      : 'No messages yet'
                    }
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;


