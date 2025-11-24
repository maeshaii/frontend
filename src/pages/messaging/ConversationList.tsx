import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ConversationSummary, getOnlineUsers, createConversation, api } from '../../services/api';
import { getProfilePicUrl } from '../../utils/profilePicUtils';
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
  showMinimal?: boolean; // If true, only show avatar and name (for Online tab)
}

const ConversationItem: React.FC<ConversationItemProps> = ({ 
  conversation, 
  isSelected, 
  onClick,
  isOnline = false,
  showMinimal = false
}) => {
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [isLoadingPic, setIsLoadingPic] = useState(false);
  const hasFetched = useRef(false);

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

  // Fetch profile picture
  useEffect(() => {
    const fetchProfilePic = async () => {
      const otherUserId = conversation.other_participant?.user_id;
      if (!otherUserId) return;

      // Check if we have avatar_url from conversation
      const avatarUrl = (conversation.other_participant as any)?.avatar_url;
      if (avatarUrl) {
        const normalizedUrl = getProfilePicUrl(avatarUrl);
        setProfilePicUrl(normalizedUrl);
        return;
      }

      // Fetch from API if not available and haven't fetched yet
      if (!hasFetched.current) {
        hasFetched.current = true;
        setIsLoadingPic(true);
        try {
          console.log('🔍 ConversationList: Fetching profile pic for user:', otherUserId);
          const response = await api.get(`alumni/profile/${otherUserId}/`);
          if (response.data && response.data.profile_pic) {
            const baseUrl = getProfilePicUrl(response.data.profile_pic);
            const profilePicUrlWithBust = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
            console.log('🔍 ConversationList: Setting profile pic URL:', profilePicUrlWithBust);
            setProfilePicUrl(profilePicUrlWithBust);
          }
        } catch (error) {
          console.error('🔍 ConversationList: Error fetching profile pic:', error);
        } finally {
          setIsLoadingPic(false);
        }
      }
    };

    // Reset hasFetched when conversation changes
    hasFetched.current = false;
    fetchProfilePic();
  }, [conversation.other_participant?.user_id, conversation.other_participant?.avatar_url]);

  const firstName = conversation.other_participant?.name?.split(' ')[0] || 'U';
  const initial = firstName.charAt(0).toUpperCase();
  const initials = getInitials(conversation.other_participant?.name || 'Unknown');

  const defaultCTULogo = '/ctu_logo-removebg-preview.png';

  return (
    <div 
      className={`conversation-item ${isSelected ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="conversation-avatar">
        <img 
          src={profilePicUrl || defaultCTULogo} 
          alt={conversation.other_participant?.name || 'User'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // Fallback to CTU logo if profile pic fails
            if (target.src !== `${window.location.origin}${defaultCTULogo}`) {
              target.src = defaultCTULogo;
            } else {
              // If CTU logo also fails, show initials
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.textContent = initials;
              }
            }
          }}
        />
        {isOnline && <div className="online-indicator"></div>}
      </div>
      
      <div className="conversation-content">
        <div className="conversation-header">
          <div className="conversation-name-container">
            <h3 className="conversation-name">
              {conversation.other_participant?.name || 'Unknown User'}
            </h3>
            {!showMinimal && conversation.is_message_request && (
              <span className="message-request-indicator" title="Message Request">
                📩
              </span>
            )}
          </div>
          {!showMinimal && (
            <span className="conversation-time">
              {conversation.updated_at ? formatTime(conversation.updated_at) : ''}
            </span>
          )}
        </div>
        
        {!showMinimal && (
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
        )}
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
  const [onlineUsersData, setOnlineUsersData] = useState<any[]>([]);
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = useState(true);

  // Calculate message request count
  const messageRequestCount = useMemo(() => {
    return conversations.filter(conv => conv.is_message_request).length;
  }, [conversations]);

  // Load online users
  useEffect(() => {
    const loadOnlineUsers = async () => {
      setIsLoadingOnlineUsers(true);
      try {
        const response = await getOnlineUsers();
        console.log('[Online Users] API Response:', response);
        if (response.success) {
          // Ensure all user_ids are numbers for consistent Set operations
          const onlineUserIds = new Set<number>(
            response.online_users.map((user: any) => Number(user.user_id))
          );
          console.log('[Online Users] Setting online users:', {
            count: onlineUserIds.size,
            userIds: Array.from(onlineUserIds),
            users: response.online_users.map((u: any) => ({ user_id: u.user_id, name: u.name }))
          });
          setOnlineUsers(onlineUserIds);
          setOnlineUsersData(response.online_users || []);
        } else {
          console.warn('[Online Users] API returned success=false:', response);
          setOnlineUsers(new Set());
          setOnlineUsersData([]);
        }
      } catch (error) {
        console.error('[Online Users] Failed to load online users:', error);
        setOnlineUsers(new Set());
        setOnlineUsersData([]);
      } finally {
        setIsLoadingOnlineUsers(false);
      }
    };

    loadOnlineUsers();
    
    // Refresh online users every 30 seconds
    const interval = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update filtered conversations when conversations prop changes
  useEffect(() => {
    setFilteredConversations(conversations);
  }, [conversations]);

  // Filter conversations based on search query and active filter
  useEffect(() => {
    // Default: All Messages should EXCLUDE message requests AND empty conversations (no messages sent)
    let filtered = activeFilter === 'all'
      ? conversations.filter(conv => {
          // CRITICAL: Exclude message requests - they should NEVER appear in All Messages
          // Double-check to ensure is_message_request is properly set
          if (conv.is_message_request === true) {
            return false;
          }
          // Additional safety check: if is_message_request is undefined/null, treat as false (regular conversation)
          // But if it's explicitly true, exclude it
          if (conv.is_message_request) {
            return false;
          }
          // Exclude conversations with no messages (empty conversations)
          // A conversation should only appear if it has at least one message
          if (!conv.last_message || !conv.last_message.content) return false;
          return true;
        })
      : conversations;
    
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
      // If still loading online users, don't filter yet (show loading state)
      if (isLoadingOnlineUsers) {
        console.log('[Online Filter] Still loading online users, skipping filter');
        filtered = [];
      } else {
        // Debug logging
        console.log('[Online Filter] Checking online status:', {
          totalConversations: conversations.length,
          onlineUsersCount: onlineUsers.size,
          onlineUsersDataCount: onlineUsersData.length,
          onlineUserIds: Array.from(onlineUsers),
          onlineUsersData: onlineUsersData.map((u: any) => ({ user_id: u.user_id, name: u.name }))
        });

        // 1) Existing conversations whose other participant is online
        // IMPORTANT: Check ALL conversations (not filtered), and ensure user_id matches
        const existingOnline = conversations.filter(conv => {
          const otherUserId = conv.other_participant?.user_id;
          if (!otherUserId) {
            return false;
          }
          
          // Check if user is in onlineUsers Set (ensure type consistency)
          const isOnline = onlineUsers.has(Number(otherUserId));
          
          // Also check onlineUsersData as fallback
          const isInOnlineData = onlineUsersData.some((u: any) => Number(u.user_id) === Number(otherUserId));
          
          if (isOnline || isInOnlineData) {
            console.log(`[Online Filter] Found online conversation: ${conv.other_participant?.name} (user_id: ${otherUserId})`);
            return true;
          }
          
          return false;
        });

        console.log(`[Online Filter] Found ${existingOnline.length} existing online conversations`);

        // 2) Virtual items for online mutuals without an existing conversation
        const existingOtherIds = new Set<number>(
          conversations
            .map(c => {
              const userId = c.other_participant?.user_id;
              return userId ? Number(userId) : null;
            })
            .filter((id): id is number => id !== null)
        );

        console.log(`[Online Filter] Existing conversation user IDs:`, Array.from(existingOtherIds));

        const virtualItems: ConversationSummary[] = (onlineUsersData || [])
          .filter((u: any) => {
            if (!u || !u.user_id) return false;
            const userId = Number(u.user_id);
            const isExisting = existingOtherIds.has(userId);
            if (!isExisting) {
              console.log(`[Online Filter] Adding virtual item for: ${u.name || `${u.f_name || ''} ${u.l_name || ''}`.trim()} (user_id: ${userId})`);
            }
            return !isExisting;
          })
          .map((u: any) => ({
            conversation_id: -Number(u.user_id), // sentinel negative id indicates virtual row
            updated_at: new Date().toISOString(),
            is_message_request: false,
            last_message: undefined,
            unread_count: 0,
            participants: [],
            other_participant: {
              user_id: Number(u.user_id),
              name: u.name || `${u.f_name || ''} ${u.l_name || ''}`.trim(),
              avatar_url: u.profile_pic || null,
            }
          }));

        console.log(`[Online Filter] Created ${virtualItems.length} virtual items`);
        console.log(`[Online Filter] Total filtered conversations: ${existingOnline.length + virtualItems.length}`);

        filtered = [...existingOnline, ...virtualItems];
      }
    }
    
    setFilteredConversations(filtered);
  }, [conversations, searchQuery, activeFilter, onlineUsers, onlineUsersData, isLoadingOnlineUsers]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange(query);
  }, [onSearchChange]);

  const handleConversationClick = useCallback(async (conversation: ConversationSummary) => {
    // If it's a virtual item (negative id), create conversation first
    if (conversation.conversation_id < 0 && conversation.other_participant?.user_id) {
      try {
        const newConv = await createConversation(conversation.other_participant.user_id);
        onConversationSelect(newConv);
        return;
      } catch (e) {
        console.error('Failed to create conversation from Online tab:', e);
        return;
      }
    }
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
              style={{ position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span>Message Request</span>
                {messageRequestCount > 0 && (
                  <span className="message-request-badge">
                    {messageRequestCount > 99 ? '99+' : messageRequestCount}
                  </span>
                )}
              </div>
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
          ) : isLoadingOnlineUsers && activeFilter === 'online' ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3 className="empty-state-title">Loading online users...</h3>
              <p className="empty-state-message">Please wait while we check who's online</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => {
              const otherUserId = conversation.other_participant?.user_id;
              const isOnline = otherUserId ? (onlineUsers.has(Number(otherUserId)) || onlineUsersData.some((u: any) => Number(u.user_id) === Number(otherUserId))) : false;
              
              return (
                <ConversationItem
                  key={conversation.conversation_id}
                  conversation={conversation}
                  isSelected={conversation.conversation_id === selectedConversationId}
                  onClick={() => handleConversationClick(conversation)}
                  isOnline={isOnline}
                  showMinimal={activeFilter === 'online'}
                />
              );
            })
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3 className="empty-state-title">No conversations found</h3>
              <p className="empty-state-message">
                {activeFilter === 'online' 
                  ? 'No online users found. Make sure you have mutual follows with online users.' 
                  : searchQuery 
                    ? 'Try adjusting your search terms' 
                    : 'Start a new conversation to get started'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationList;