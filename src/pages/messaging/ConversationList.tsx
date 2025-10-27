import React, { useState, useEffect, useCallback } from 'react';
import { ConversationSummary, getOnlineUsers } from '../../services/api';
import './Messaging.css';

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedConversationId?: number;
  onConversationSelect: (conversation: ConversationSummary) => void;
  onSearchChange: (query: string) => void;
  isLoading?: boolean;
}

interface ConversationItemProps {
  conversation: ConversationSummary;
  isSelected: boolean;
  onClick: () => void;
  isOnline?: boolean;
}

const ConversationItem: React.FC<ConversationItemProps> = ({ 
  conversation, 
  isSelected, 
  onClick,
  isOnline = false
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Use the passed isOnline prop instead of random

  return (
    <div 
      className={`conversation-item ${isSelected ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="conversation-avatar">
        {getInitials(conversation.other_participant?.name || 'Unknown')}
        {isOnline && <div className="online-indicator"></div>}
      </div>
      
      <div className="conversation-content">
        <div className="conversation-header">
          <div className="conversation-name-container">
            <h3 className="conversation-name">
              {conversation.other_participant?.name || 'Unknown User'}
            </h3>
            {conversation.is_message_request && (
              <span className="message-request-indicator" title="Message Request">
                📩
              </span>
            )}
          </div>
          <span className="conversation-time">
            {conversation.updated_at ? formatTime(conversation.updated_at) : ''}
          </span>
        </div>
        
        <div className="conversation-meta">
          <p className="conversation-preview">
            {conversation.last_message?.content || 'No messages yet'}
          </p>
          {conversation.unread_count && conversation.unread_count > 0 && (
            <div className="unread-badge">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onConversationSelect,
  onSearchChange,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'request' | 'online'>('all');
  const [filteredConversations, setFilteredConversations] = useState<ConversationSummary[]>(conversations);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  // Load online users
  useEffect(() => {
    const loadOnlineUsers = async () => {
      try {
        const response = await getOnlineUsers();
        if (response.success) {
          const onlineUserIds = new Set<number>(response.online_users.map((user: any) => user.user_id));
          setOnlineUsers(onlineUserIds);
        }
      } catch (error) {
        console.error('Failed to load online users:', error);
      }
    };

    loadOnlineUsers();
    
    // Refresh online users every 30 seconds
    const interval = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter conversations based on search query and active filter
  useEffect(() => {
    let filtered = conversations;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(conv => 
        conv.other_participant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.last_message?.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (activeFilter === 'request') {
      // Filter for message requests (conversations with is_message_request = true)
      filtered = filtered.filter(conv => conv.is_message_request);
    } else if (activeFilter === 'online') {
      // Filter for online users (mutual follows who are online)
      filtered = filtered.filter(conv => {
        const otherUserId = conv.other_participant?.user_id;
        return otherUserId && onlineUsers.has(otherUserId);
      });
    }
    
    setFilteredConversations(filtered);
  }, [conversations, searchQuery, activeFilter, onlineUsers]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange(query);
  }, [onSearchChange]);

  const handleConversationClick = useCallback((conversation: ConversationSummary) => {
    onConversationSelect(conversation);
  }, [onConversationSelect]);

  return (
    <div className="messaging-sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Messages</h1>
      </div>
      
      <div className="conversation-list">
        {/* Search Container */}
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search messages..." 
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        {/* Messages Filter Segments */}
        <div className="messages-filter-section">
          <div className="filter-segments">
            <button 
              className={`filter-segment ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Messages
            </button>
            <button 
              className={`filter-segment ${activeFilter === 'request' ? 'active' : ''}`}
              onClick={() => setActiveFilter('request')}
            >
              Message Request
            </button>
            <button 
              className={`filter-segment ${activeFilter === 'online' ? 'active' : ''}`}
              onClick={() => setActiveFilter('online')}
            >
              Online
            </button>
          </div>
        </div>
        {/* Conversations List */}
        <div className="conversations-content">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="conversation-item loading-skeleton">
                <div className="conversation-avatar loading-skeleton" style={{ width: '56px', height: '56px', borderRadius: '50%' }}></div>
                <div className="conversation-content" style={{ flex: 1 }}>
                  <div className="conversation-header">
                    <div className="loading-skeleton" style={{ height: '16px', width: '60%', marginBottom: '8px' }}></div>
                    <div className="loading-skeleton" style={{ height: '12px', width: '40px' }}></div>
                  </div>
                  <div className="loading-skeleton" style={{ height: '14px', width: '80%' }}></div>
                </div>
              </div>
            ))
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => {
              const otherUserId = conversation.other_participant?.user_id;
              const isOnline = otherUserId ? onlineUsers.has(otherUserId) : false;
              
              return (
                <ConversationItem
                  key={conversation.conversation_id}
                  conversation={conversation}
                  isSelected={conversation.conversation_id === selectedConversationId}
                  onClick={() => handleConversationClick(conversation)}
                  isOnline={isOnline}
                />
              );
            })
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3 className="empty-state-title">No conversations found</h3>
              <p className="empty-state-message">
                {searchQuery ? 'Try adjusting your search terms' : 'Start a new conversation to get started'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationList;