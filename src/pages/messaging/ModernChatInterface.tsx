import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageItem, 
  ConversationSummary, 
  listMessages, 
  sendMessage, 
  markConversationRead,
  getUserInfo,
  getOnlineUsers,
  uploadAttachment,
  deleteMessageApi,
  updateMessageApi,
  deleteConversation,
  api
} from '../../services/api';
import { ConversationWebSocket, WsEvent } from '../../services/websocketHelper';
import { TypingIndicator } from '../../services/typingIndicator';
import { getConversationWsUrl } from '../../services/api';
import { getFileIcon, getFileTypeDisplayName, formatFileSize, isImageFile, isVideoFile, isAudioFile, canPreview, FileCategory } from '../../utils/fileUtils';
import { deduplicateMessages, addMessageWithDeduplication, replaceTempMessage, removeTempMessage, isDuplicateMessage, sortMessagesBySequence, detectSequenceGaps, UiMessage } from '../../utils/messageUtils';
import { sanitizeUserInput, validateMessageType } from '../../utils/securityUtils';
import { WebSocketErrorBoundary } from '../../components/ErrorBoundary';
import { useLogger } from '../../utils/logger';
import { renderTextWithLinks } from '../../utils/linkRenderer';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { getProfilePicUrl } from '../../utils/profilePicUtils';
import './Messaging.css';

interface ModernChatInterfaceProps {
  conversation: ConversationSummary | null;
  onBack?: () => void;
}

interface MessageGroup {
  sender_id: number;
  sender_name: string;
  messages: UiMessage[];
  timestamp: string;
}

const ModernChatInterface: React.FC<ModernChatInterfaceProps> = ({ conversation, onBack }) => {
  const logger = useLogger('ModernChatInterface');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [isParticipantOnline, setIsParticipantOnline] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const hasMarkedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [downloadFile, setDownloadFile] = useState<{url: string, name: string} | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState<string>('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{x: number, y: number, isOwn: boolean} | null>(null);
  const [messageReactions, setMessageReactions] = useState<{[key: string]: Array<{emoji: string, userId: number, userName?: string}>}>({});
  const [contextMenuMessageId, setContextMenuMessageId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  
  // Profile picture state management (similar to notifications)
  const [userProfilePics, setUserProfilePics] = useState<{[key: string]: string}>(() => {
    try {
      const stored = localStorage.getItem('messagingUserProfilePics');
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });
  const [loadingProfilePics, setLoadingProfilePics] = useState<Set<string>>(new Set());
  const loadedProfilePics = useRef<Set<string>>(new Set());
  
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest'
        });
      }
    });
  }, []);

  // Initialize current user and listen for updates
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await getUserInfo();
        console.log('🔍 Current user loaded:', user);
        console.log('🔍 Profile pic:', user?.profile_pic);
        console.log('🔍 Avatar URL:', user?.avatar_url);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to get user info:', error);
      }
    };
    initUser();

    // Listen for storage changes (when profile picture is updated elsewhere)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        try {
          const updatedUser = e.newValue ? JSON.parse(e.newValue) : null;
          if (updatedUser) {
            setCurrentUser(updatedUser);
          }
        } catch (error) {
          console.error('Failed to parse updated user from storage:', error);
        }
      }
    };

    // Listen for custom events when profile is updated
    const handleProfileUpdate = () => {
      initUser();
    };

    const handleUserDataUpdate = () => {
      initUser();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('userDataUpdated', handleUserDataUpdate);

    // Also refresh periodically to catch profile picture updates
    const refreshInterval = setInterval(() => {
      initUser();
    }, 30000); // Refresh every 30 seconds

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('userDataUpdated', handleUserDataUpdate);
      clearInterval(refreshInterval);
    };
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker) {
        const target = event.target as HTMLElement;
        if (!target.closest('.emoji-picker-container') && !target.closest('.input-action-btn')) {
          setShowEmojiPicker(false);
        }
      }
      
      // Close context menu when clicking outside
      if (contextMenuMessageId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.message-context-menu')) {
          setContextMenuMessageId(null);
          setContextMenuPosition(null);
        }
      }
      
      // Close reaction picker when clicking outside
      if (reactionPickerMessageId) {
        const target = event.target as HTMLElement;
        if (!target.closest('.reaction-picker')) {
          setReactionPickerMessageId(null);
          setReactionPickerPosition(null);
        }
      }
    };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showEmojiPicker, contextMenuMessageId, reactionPickerMessageId]);

  // Track whether the other participant is currently online via the shared API
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;
    const participantId = conversation?.other_participant?.user_id;

    const updateParticipantStatus = async () => {
      if (!participantId) {
        setIsParticipantOnline(false);
        return;
      }

      try {
        const response = await getOnlineUsers();
        if (!isMounted) return;
        if (!response?.success) {
          setIsParticipantOnline(false);
          return;
        }

        const onlineIds = new Set<number>(
          (Array.isArray(response.online_users) ? response.online_users : []).map((user: any) =>
            Number(user.user_id)
          )
        );
        setIsParticipantOnline(onlineIds.has(Number(participantId)));
      } catch (error) {
        console.error('Failed to determine participant online status:', error);
        if (isMounted) {
          setIsParticipantOnline(false);
        }
      }
    };

    if (participantId) {
      updateParticipantStatus();
      intervalId = setInterval(updateParticipantStatus, 30000);
    } else {
      setIsParticipantOnline(false);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [conversation?.other_participant?.user_id]);

  // Handle click outside to close dropdown menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showConversationMenu && !target.closest('.conversation-menu-btn') && !target.closest('.conversation-dropdown-menu')) {
        setShowConversationMenu(false);
      }
    };

    if (showConversationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConversationMenu]);

  // Fetch profile picture from API (similar to notifications) - MUST BE DEFINED BEFORE loadMessages
  const fetchUserProfilePic = useCallback(async (userId: number | string): Promise<string | null> => {
    // CRITICAL: Validate user_id before ANY operations
    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
    if (!userId || isNaN(userIdNum) || userIdNum <= 0) {
      console.warn('🔍 Invalid user_id provided to fetchUserProfilePic:', userId);
      return null;
    }
    
    const userIdStr = String(userId);
    
    // Check cache first
    if (userProfilePics[userIdStr]) {
      return userProfilePics[userIdStr];
    }
    
    // Check if already loading
    if (loadingProfilePics.has(userIdStr)) {
      return null;
    }
    
    // Check if already loaded
    if (loadedProfilePics.current.has(userIdStr)) {
      return null;
    }
    
    // Mark as loading
    setLoadingProfilePics(prev => new Set(prev).add(userIdStr));
    
    try {
      console.log('🔍 Fetching profile pic for user:', userIdStr);
      const response = await api.get(`alumni/profile/${userIdStr}/`);
      console.log('🔍 Profile API response:', response.data);
      
      if (response.data && response.data.profile_pic) {
        const baseUrl = getProfilePicUrl(response.data.profile_pic);
        const profilePicUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        console.log('🔍 Setting profile pic URL:', profilePicUrl);
        
        setUserProfilePics(prev => {
          const newPics = { ...prev, [userIdStr]: profilePicUrl };
          localStorage.setItem('messagingUserProfilePics', JSON.stringify(newPics));
          return newPics;
        });
        loadedProfilePics.current.add(userIdStr);
        return profilePicUrl;
      } else {
        console.log('🔍 No profile picture found for user:', userIdStr);
        loadedProfilePics.current.add(userIdStr);
      }
    } catch (error) {
      console.error('🔍 Error fetching profile pic:', error);
      loadedProfilePics.current.add(userIdStr);
    } finally {
      setLoadingProfilePics(prev => {
        const newSet = new Set(prev);
        newSet.delete(userIdStr);
        return newSet;
      });
    }
    
    return null;
  }, [userProfilePics, loadingProfilePics]);

  const loadMessages = useCallback(async (cursor?: string) => {
    if (!conversation) return;
    
    try {
      const data = await listMessages(conversation.conversation_id, { cursor, limit: 50 });
      console.log('🔍 Loaded messages:', data.results.map((m: MessageItem) => ({
        messageId: m.message_id,
        senderId: m.sender.user_id,
        senderName: m.sender.name,
        senderAvatar: m.sender.avatar_url,
      })));
      const mapped: UiMessage[] = data.results.map((m: MessageItem) => ({
        id: String(m.message_id),
        content: m.content,
        sender_id: m.sender.user_id,
        sender_name: m.sender.name,
        sender_avatar: m.sender.avatar_url || null,
        created_at: m.created_at,
        is_read: m.is_read,
        message_type: (m as any).message_type,
        attachment_url: (() => {
          const attachment = ((m as any).attachments && (m as any).attachments[0]);
          if (!attachment) return null;
          
          const url = attachment.file_url || attachment.file || null;
          if (!url) return null;
          
          return url.startsWith('http') ? url : `${window.location.origin}${url}`;
        })(),
        attachment_info: (() => {
          const attachment = ((m as any).attachments && (m as any).attachments[0]);
          if (!attachment) return undefined;
          return {
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            file_category: attachment.file_category as FileCategory,
            file_size: attachment.file_size,
          };
        })(),
        reply_to: (m as any).reply_to ? {
          message_id: String((m as any).reply_to.message_id),
          content: (m as any).reply_to.content,
          sender_name: (m as any).reply_to.sender_name
        } : undefined,
        is_edited: (m as any).is_edited || false,
      }));
      
      // Load reactions from backend
      const reactionsFromBackend: { [key: string]: Array<{ emoji: string; userId: number; userName?: string }> } = {};
      data.results.forEach((m: any) => {
        if (m.reactions && m.reactions.length > 0) {
          reactionsFromBackend[String(m.message_id)] = m.reactions;
        }
      });
      
      // Update reactions state with backend data
      if (Object.keys(reactionsFromBackend).length > 0) {
        setMessageReactions(prev => ({ ...prev, ...reactionsFromBackend }));
      }

      setMessages(prev => {
        const joined = cursor ? [...mapped, ...prev] : [...prev.filter(p => !mapped.some(m => m.id === p.id)), ...mapped];
        const unique = deduplicateMessages(joined);
        if (!cursor) {
          // Delay scroll to ensure messages are rendered
          setTimeout(() => {
            requestAnimationFrame(scrollToBottom);
          }, 200);
        }
        return unique;
      });
      
      setNextCursor(data.next_cursor ?? null);
      
      // Fetch profile pictures for all unique senders in loaded messages
      const uniqueSenders = new Set<number>();
      mapped.forEach((msg) => {
        // Validate sender_id before fetching
        if (msg.sender_id && msg.sender_id > 0 && 
            !uniqueSenders.has(msg.sender_id) && 
            !loadedProfilePics.current.has(String(msg.sender_id))) {
          uniqueSenders.add(msg.sender_id);
          fetchUserProfilePic(msg.sender_id);
        }
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation, scrollToBottom, fetchUserProfilePic]);

  const connectWebSocket = useCallback(async () => {
    if (!conversation) return;
    
    // Check if we're already connecting or have an active connection
    if (isConnecting || (wsRef.current && connectionStatus === 'connected')) {
      console.log('⏭️ [WebSocket] Already connecting or connected, skipping');
      return;
    }

    // Disconnect existing WebSocket first
    if (wsRef.current) {
      console.log('🔌 [WebSocket] Disconnecting existing connection');
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    setIsConnecting(true);
    console.log('🔌 [WebSocket] Starting connection for conversation:', conversation.conversation_id);

    try {
      // Only fetch CSRF if needed (WebSockets don't need CSRF tokens)
      // await api.get('csrf/');
      
      let token = null;
      try {
        token = localStorage.getItem('accessToken') || 
                localStorage.getItem('access_token') || 
                localStorage.getItem('token') || 
                localStorage.getItem('jwt_token') ||
                localStorage.getItem('auth_token');
        
        if (!token) {
          const refreshToken = localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const tokenResponse = await api.post('token/refresh/', {
                refresh: refreshToken
              });
              token = tokenResponse.data.access;
              localStorage.setItem('accessToken', token);
            } catch (refreshError) {
              logger.warn('Token refresh failed, will use session auth', refreshError);
            }
          }
        }
      } catch (error) {
        logger.warn('Could not get JWT token for WebSocket, using session auth', error);
      }
      
      const wsUrl = getConversationWsUrl(conversation.conversation_id);
      const ws = new ConversationWebSocket(wsUrl);
      wsRef.current = ws;
    
      // Initialize typing indicator (no longer creates separate WebSocket)
      const typingIndicator = new TypingIndicator({
        conversationId: Number(conversation.conversation_id),
        userId: currentUser?.user_id || 0,
        userName: currentUser?.full_name || 'Unknown',
        onTypingStart: (userId, userName) => {
          setTypingUsers(prev => new Set([...prev, userId]));
        },
        onTypingStop: (userId) => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        },
        onError: (error) => {
          // Silently handle - no separate WebSocket needed
        }
      });
      typingIndicatorRef.current = typingIndicator;
      
      // Note: Typing indicator no longer connects separately

      const statusCallback = (status: any) => {
        console.log('🔌 [WebSocket] Status changed:', status);
        setConnectionStatus(status);
        if (status === 'connected' && !hasMarkedRef.current) {
          console.log('✅ [WebSocket] Connected successfully - Real-time messaging is active!');
          markConversationRead(conversation.conversation_id).catch(() => {});
          hasMarkedRef.current = true;
          setHasMarkedAsRead(true);
          // Optimistically broadcast to parent/other UI that unread is now zero
          window.dispatchEvent(new CustomEvent('conversationRead', { detail: { conversationId: conversation.conversation_id } }));
        } else if (status === 'error') {
          console.error('❌ [WebSocket] Connection error - Messages will not be real-time');
        } else if (status === 'disconnected') {
          console.warn('⚠️ [WebSocket] Disconnected - Messages will not be real-time');
        }
      };

      const messageCallback = (event: WsEvent) => {
        const myId = currentUser?.user_id ?? (currentUser as any)?.id;
        console.log('📨 [WebSocket] Event received:', event.type);
        switch (event.type) {
          case 'message':
            // Handle nested message structure from WebSocket
            const messageData = event.message || event;
            if (messageData.sender_id === myId) {
              console.log('⏭️ [WebSocket] Skipping own message echo');
              break;
            }
            
            console.log('📥 [WebSocket] NEW MESSAGE from other user! Real-time working!');
            console.log('📥 [WebSocket] Message data:', messageData);
            console.log('📥 [WebSocket] Content:', messageData.content);
            
            const newMessage: UiMessage = {
              id: String(messageData.message_id),
              content: messageData.content || '',
              sender_id: messageData.sender_id || 0,
              sender_name: messageData.sender_name || '',
              sender_avatar: messageData.sender_avatar || messageData.sender?.avatar_url || null,
              created_at: messageData.created_at || new Date().toISOString(),
              is_read: false,
              message_type: messageData.message_type,
              attachment_url: messageData.attachment_url || (messageData.attachments && messageData.attachments[0]?.file_url),
              attachment_info: messageData.attachment_info || (messageData.attachments && messageData.attachments[0] ? {
                file_name: messageData.attachments[0].file_name,
                file_type: messageData.attachments[0].file_type,
                file_category: messageData.attachments[0].file_category,
                file_size: messageData.attachments[0].file_size,
              } : undefined),
              reply_to: messageData.reply_to ? {
                message_id: String(messageData.reply_to.message_id),
                content: messageData.reply_to.content,
                sender_name: messageData.reply_to.sender_name
              } : undefined,
              is_edited: messageData.is_edited || false,
            };
            
            console.log('Created new message:', newMessage); // Debug log
            
            setMessages(prev => {
              if (isDuplicateMessage(prev, newMessage)) {
                return prev;
              }
              return addMessageWithDeduplication(prev, newMessage);
            });
            
            // Emit event for new message to update badge (only if not from current user)
            if (messageData.sender_id !== currentUser?.user_id && messageData.sender_id !== currentUser?.id) {
              window.dispatchEvent(new CustomEvent('newMessage', { 
                detail: { 
                  conversationId: conversation?.conversation_id,
                  message: newMessage 
                } 
              }));
              // Also refresh conversations to update unread count
              if (conversation) {
                import('../../services/api').then(({ listConversations }) => {
                  listConversations().then(conversations => {
                    window.dispatchEvent(new CustomEvent('conversationsUpdated', { detail: conversations }));
                  }).catch(err => console.error('Failed to refresh conversations:', err));
                });
              }
            }
            
            // Delay scroll to ensure messages are rendered
            setTimeout(() => {
              requestAnimationFrame(scrollToBottom);
            }, 200);
            break;
          case 'typing':
            setTypingUsers((prev) => {
              const newSet = new Set(prev);
              if (event.is_typing) {
                if (event.user_id) newSet.add(event.user_id);
              } else {
                if (event.user_id) newSet.delete(event.user_id);
              }
              return newSet;
            });
            break;
          case 'read_receipt':
            break;
          case 'reaction':
            // Handle real-time reaction updates
            console.log('[Reaction] WebSocket event received:', event);
            if (event.message_id && event.emoji && event.user_id !== undefined) {
              const messageId = String(event.message_id);
              const userId = event.user_id;
              const userName = event.user_name || 'Unknown';
              const emoji = event.emoji;
              const action = event.action;
              
              setMessageReactions(prev => {
                const existing = prev[messageId] || [];
                
                if (action === 'add') {
                  // Add reaction if not already present
                  if (!existing.find(r => r.userId === userId && r.emoji === emoji)) {
                    console.log(`[Reaction] Adding ${emoji} from user ${userId} to message ${messageId}`);
                    return { ...prev, [messageId]: [...existing, { emoji, userId, userName }] };
                  }
                } else if (action === 'remove') {
                  // Remove reaction
                  const updated = existing.filter(r => !(r.userId === userId && r.emoji === emoji));
                  if (updated.length === 0) {
                    const newReactions = { ...prev };
                    delete newReactions[messageId];
                    console.log(`[Reaction] Removed ${emoji} from user ${userId}, message ${messageId} has no reactions`);
                    return newReactions;
                  }
                  console.log(`[Reaction] Removed ${emoji} from user ${userId} on message ${messageId}`);
                  return { ...prev, [messageId]: updated };
                }
                return prev;
              });
            }
            break;
          case 'edit':
            // Handle message edit
            console.log('[Edit] WebSocket event received:', event);
            if (event.message_id && event.content) {
              const messageId = String(event.message_id);
              const content = event.content;
              setMessages(prev => prev.map(m => 
                m.id === messageId
                  ? { ...m, content, is_edited: true } 
                  : m
              ));
            }
            break;
          case 'delete':
            // Handle message delete
            console.log('[Delete] WebSocket event received:', event);
            if (event.message_id) {
              setMessages(prev => prev.filter(m => m.id !== String(event.message_id)));
            }
            break;
        }
      };

      ws.onStatus(statusCallback);
      ws.onMessage(messageCallback);

      // Handle WebSocket connection gracefully
      ws.connect().catch(error => {
        // Log but don't throw - chat will still work without real-time updates
        console.warn('WebSocket connection failed for conversation, will use polling:', error.message);
        setConnectionStatus('disconnected');
        // Don't show error to user - app will continue to work
      });
    } catch (error) {
      // Handle unexpected errors gracefully
      console.warn('Failed to establish WebSocket session (will continue without real-time updates):', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, scrollToBottom, logger, connectionStatus]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation) {
      setMessages([]);
      setNextCursor(null);
      setHasMarkedAsRead(false);
      hasMarkedRef.current = false;
      setTypingUsers(new Set());
      loadMessages();
    }
  }, [conversation?.conversation_id]);

  // Connect WebSocket when conversation changes (separate effect to avoid loops)
  useEffect(() => {
    if (conversation && currentUser) {
      console.log('🔌 [WebSocket] Setting up connection for conversation:', conversation.conversation_id);
      connectWebSocket();
    }

    return () => {
      console.log('🔌 [WebSocket] Cleaning up connection');
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setIsConnecting(false);
    };
  }, [conversation?.conversation_id, currentUser?.user_id]);

  const handleSend = async () => {
    const inputText = inputValue.trim();
    if (!inputText || !conversation) return;

    console.log('Sending message:', inputText); // Debug log

    try {
      let sanitizedText = sanitizeUserInput(inputText);
      console.log('Sanitized text:', sanitizedText); // Debug log
      
      if (!sanitizedText) {
        logger.warn('Message content is empty after sanitization');
        return;
      }

      const tempId = Date.now().toString();
      
      // Save reply ID before clearing (needed for API request)
      const replyToIdForApi = replyingToMessageId;
      
      // Build reply_to object if replying
      let replyToObj = undefined;
      if (replyingToMessageId) {
        const repliedMessage = messages.find(m => m.id === replyingToMessageId);
        if (repliedMessage) {
          replyToObj = {
            message_id: repliedMessage.id,
            content: repliedMessage.content || 'Attachment',
            sender_name: repliedMessage.sender_name
          };
        }
      }
      
      const tempMessage: UiMessage = {
        id: tempId,
        content: sanitizedText,
        sender_id: currentUser?.user_id || 0,
        sender_name: currentUser?.full_name || 'You',
        sender_avatar: currentUser?.profile_pic || currentUser?.avatar_url || null,
        created_at: new Date().toISOString(),
        is_read: false,
        tempId,
        reply_to: replyToObj,
      };

      setMessages(prev => addMessageWithDeduplication(prev, tempMessage));
      setInputValue('');
      setReplyingToMessageId(null); // Clear reply state after sending
      
      typingIndicatorRef.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      try {
        // Build request payload with optional reply_to_message_id
        const payload: any = { content: sanitizedText, message_type: 'text' };
        if (replyToIdForApi) {
          payload.reply_to_message_id = parseInt(replyToIdForApi);
        }
        
        console.log('Sending to API:', payload); // Debug log
        const saved = await sendMessage(conversation.conversation_id, payload);
        console.log('Message saved:', saved); // Debug log
      
        const savedMessage: UiMessage = {
          id: String(saved.message_id),
          content: saved.content,
          sender_id: saved.sender.user_id,
          sender_name: saved.sender.name,
          sender_avatar: saved.sender.avatar_url || null,
          created_at: saved.created_at,
          is_read: saved.is_read,
          message_type: (saved as any).message_type,
          attachment_url: ((saved as any).attachments && (saved as any).attachments[0]?.file_url) || null,
          reply_to: (saved as any).reply_to ? {
            message_id: String((saved as any).reply_to.message_id),
            content: (saved as any).reply_to.content,
            sender_name: (saved as any).reply_to.sender_name
          } : undefined,
          is_edited: (saved as any).is_edited || false,
        };
        
        console.log('Created saved message:', savedMessage); // Debug log
        
        setMessages(prev => replaceTempMessage(prev, tempId, savedMessage));
      } catch (error) {
        logger.error('Send failed', error);
        setMessages(prev => removeTempMessage(prev, tempId));
        // Show user-friendly error message
        alert('Failed to send message. Please try again.');
      }
      
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      logger.error('Input sanitization failed', error);
      // More specific error message based on error type
      if (error instanceof Error) {
        if (error.message.includes('too long')) {
          alert('Message is too long. Please shorten your message.');
        } else if (error.message.includes('empty after sanitization')) {
          alert('Message contains only invalid characters. Please check your input.');
        } else {
          alert('Invalid message content. Please check your input and try again.');
        }
      } else {
        alert('Invalid message content. Please check your input and try again.');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputValue(text);
    
    if (text.length > 0) {
      typingIndicatorRef.current?.sendTyping(true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = window.setTimeout(() => {
        typingIndicatorRef.current?.sendTyping(false);
      }, 2000);
    } else {
      typingIndicatorRef.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputValue(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    // Focus back on the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const loadMoreMessages = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await loadMessages(nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, loadMessages]);

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const handleEditMessage = async (messageId: string) => {
    if (!conversation || !editMessageContent.trim()) return;
    
    try {
      const updated = await updateMessageApi(conversation.conversation_id, parseInt(messageId), editMessageContent);
      
      const updatedMessage: UiMessage = {
        id: String(updated.message_id),
        content: updated.content,
        sender_id: updated.sender.user_id,
        sender_name: updated.sender.name,
        sender_avatar: updated.sender.avatar_url || null,
        created_at: updated.created_at,
        is_read: updated.is_read,
        message_type: (updated as any).message_type,
        attachment_url: ((updated as any).attachments && (updated as any).attachments[0]?.file_url) || null,
        reply_to: (updated as any).reply_to ? {
          message_id: String((updated as any).reply_to.message_id),
          content: (updated as any).reply_to.content,
          sender_name: (updated as any).reply_to.sender_name
        } : undefined,
        is_edited: (updated as any).is_edited || true,
      };
      
      setMessages(prev => prev.map(m => m.id === messageId ? updatedMessage : m));
      setEditingMessageId(null);
      setEditMessageContent('');
    } catch (error) {
      console.error('Failed to update message:', error);
      alert('Failed to update message. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversation) return;
    
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    
    try {
      await deleteMessageApi(conversation.conversation_id, parseInt(messageId));
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setDeletingMessageId(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    
    setIsDeletingConversation(true);
    try {
      await deleteConversation(conversation.conversation_id);
      logger.info('Conversation deleted successfully');
      
      // Clear conversation and close modals
      setShowDeleteConfirmation(false);
      setShowConversationMenu(false);
      
      // Navigate back without page reload to avoid white screen
      if (onBack) {
        onBack();
      } else {
        // Navigate to correct route (/messages not /messaging)
        navigate('/messages', { replace: true });
      }
      
      // Trigger conversation list refresh via custom event instead of reload
      window.dispatchEvent(new CustomEvent('conversationDeleted', { 
        detail: { conversation_id: conversation.conversation_id } 
      }));
    } catch (error) {
      logger.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const getAvatarDisplay = useCallback((message: UiMessage) => {
    const firstName = message.sender_name?.split(' ')[0] || 'U';
    const initial = firstName.charAt(0).toUpperCase();
    
    // Determine if this is the current user's message
    const myId = currentUser?.user_id ?? (currentUser as any)?.id;
    const isOwnMsg = message.sender_id === myId;
    
    // Get avatar URL - prioritize cached, then message avatar, then current user's profile pic
    const senderIdStr = String(message.sender_id);
    let avatarUrl: string | null = null;
    
    // Check cache first
    if (userProfilePics[senderIdStr]) {
      avatarUrl = userProfilePics[senderIdStr];
    }
    // If not cached, try message sender_avatar
    else if (message.sender_avatar) {
      avatarUrl = getProfilePicUrl(message.sender_avatar);
    }
    // For own messages, use current user's profile picture
    else if (isOwnMsg && currentUser) {
      const currentUserPic = currentUser?.profile_pic || currentUser?.avatar_url;
      if (currentUserPic) {
        avatarUrl = getProfilePicUrl(currentUserPic);
      }
    }
    
    // Fetch profile picture if we don't have it yet (with validation)
    if (!avatarUrl && message.sender_id && message.sender_id > 0 && !loadedProfilePics.current.has(senderIdStr)) {
      fetchUserProfilePic(message.sender_id);
    }
    
    // Default CTU logo path
    const defaultCTULogo = '/ctu_logo-removebg-preview.png';
    
    if (avatarUrl) {
      // Add cache-busting parameter
      const separator = avatarUrl.includes('?') ? '&' : '?';
      const urlWithBust = `${avatarUrl}${separator}cb=${Date.now()}`;
      
      return (
        <img 
          src={urlWithBust} 
          alt={message.sender_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            // Fall back to CTU logo on error
            target.src = defaultCTULogo;
            target.onerror = null; // Prevent infinite loop if CTU logo also fails
          }}
        />
      );
    }
    
    // No avatar URL - use CTU logo as default
    return (
      <img 
        src={defaultCTULogo} 
        alt={message.sender_name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        onError={(e) => {
          // If CTU logo fails, fall back to initial letter
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px; border-radius: 50%;">${initial}</div>`;
          }
        }}
      />
    );
  }, [currentUser, userProfilePics, fetchUserProfilePic]);

  const isOwnMessage = useCallback((message: UiMessage) => {
    const myId = currentUser?.user_id ?? (currentUser as any)?.id;
    return message.sender_id === myId;
  }, [currentUser]);

  // Group messages by sender and time proximity
  const groupedMessages = useMemo(() => {
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup | null = null;
    const myId = currentUser?.user_id ?? (currentUser as any)?.id;

    messages.forEach((message, index) => {
      const isOwn = message.sender_id === myId;
      const prevMessage = index > 0 ? messages[index - 1] : null;
      
      // Check if we should start a new group
      const shouldStartNewGroup = !currentGroup || 
        currentGroup.sender_id !== message.sender_id ||
        (prevMessage && new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 5 * 60 * 1000); // 5 minutes

      if (shouldStartNewGroup) {
        currentGroup = {
          sender_id: message.sender_id,
          sender_name: message.sender_name,
          messages: [message],
          timestamp: message.created_at
        };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  }, [messages, currentUser]);

  const typingUsersArray = useMemo(() => {
    return Array.from(typingUsers);
  }, [typingUsers]);

  // Validate conversation before rendering
  if (!conversation || !conversation.conversation_id || conversation.conversation_id <= 0) {
    return null;
  }

  // Validate other_participant to prevent 404 errors
  if (!conversation.other_participant || !conversation.other_participant.user_id || conversation.other_participant.user_id <= 0) {
    console.warn('ModernChatInterface: Invalid conversation participant data', conversation);
    return null;
  }

  return (
    <WebSocketErrorBoundary
      resetOnPropsChange={true}
      resetKeys={[conversation?.conversation_id]}
      onError={(error, errorInfo) => {
        console.error('WebSocket Error in ChatInterface:', error, errorInfo);
      }}
    >
      <div className="chat-main">
        {/* Mobile Header */}
        {onBack && (
          <div className="mobile-header">
            <button onClick={onBack} className="back-btn">
              ← Back
            </button>
            <h2 
              className="mobile-title"
              onClick={() => {
                const otherUserId = conversation.other_participant?.user_id;
                if (otherUserId) {
                  navigate(`/profile/${otherUserId}`);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {conversation.other_participant?.name || 'Unknown User'}
            </h2>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button 
                onClick={() => setShowConversationMenu(!showConversationMenu)}
                className="conversation-menu-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                  color: '#fff'
                }}
              >
                ⋮
              </button>
              {showConversationMenu && (
                <div 
                  className="conversation-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    minWidth: '200px',
                    zIndex: 1000,
                    marginTop: '8px'
                  }}
                >
                  <button
                    onClick={() => {
                      setShowConversationMenu(false);
                      setShowDeleteConfirmation(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#dc3545',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🗑️ Delete Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desktop Header */}
        {!onBack && (
          <div className="chat-header">
            <div 
              className="chat-header-avatar"
              onClick={() => {
                const otherUserId = conversation.other_participant?.user_id;
                if (otherUserId) {
                  navigate(`/profile/${otherUserId}`);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {(() => {
                const otherParticipant = conversation.other_participant;
                const otherUserId = otherParticipant?.user_id;
                const otherUserIdStr = otherUserId ? String(otherUserId) : null;
                const firstName = otherParticipant?.name?.split(' ')[0] || 'U';
                const initial = firstName.charAt(0).toUpperCase();
                const defaultCTULogo = '/ctu_logo-removebg-preview.png';
                
                // Check cache first
                let avatarUrl: string | null = null;
                if (otherUserIdStr && userProfilePics[otherUserIdStr]) {
                  avatarUrl = userProfilePics[otherUserIdStr];
                }
                // Try conversation other_participant avatar_url
                else if ((otherParticipant as any)?.avatar_url) {
                  avatarUrl = getProfilePicUrl((otherParticipant as any).avatar_url);
                }
                
                // Fetch profile picture if we don't have it yet (with validation)
                if (!avatarUrl && otherUserIdStr && otherUserId && otherUserId > 0 && !loadedProfilePics.current.has(otherUserIdStr)) {
                  fetchUserProfilePic(otherUserId);
                }
                
                const finalAvatarUrl = avatarUrl || defaultCTULogo;
                const separator = finalAvatarUrl.includes('?') ? '&' : '?';
                const urlWithBust = `${finalAvatarUrl}${separator}cb=${Date.now()}`;
                
                return (
                  <img 
                    src={urlWithBust} 
                    alt={otherParticipant?.name || 'User'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      // Fallback to CTU logo if profile pic fails
                      if (!target.src.includes('ctu_logo')) {
                        target.src = defaultCTULogo;
                      } else {
                        // If CTU logo also fails, show initials
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.textContent = initial;
                        }
                      }
                    }}
                  />
                );
              })()}
            </div>
            <div 
              className="chat-header-info"
              onClick={() => {
                const otherUserId = conversation.other_participant?.user_id;
                if (otherUserId) {
                  navigate(`/profile/${otherUserId}`);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <h2 className="chat-header-name">
                {conversation.other_participant?.name || 'Unknown User'}
              </h2>
              <p className={`chat-header-status ${isParticipantOnline ? 'status-online' : 'status-offline'}`}>
                {isParticipantOnline ? 'Online' : 'Offline'}
                <span className="chat-header-connection-status">
                  {connectionStatus === 'connected'
                    ? 'Connected'
                    : connectionStatus === 'connecting'
                      ? 'Connecting…'
                      : 'Disconnected'}
                </span>
              </p>
            </div>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button 
                onClick={() => setShowConversationMenu(!showConversationMenu)}
                className="conversation-menu-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                  color: '#666'
                }}
              >
                ⋮
              </button>
              {showConversationMenu && (
                <div 
                  className="conversation-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    backgroundColor: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    minWidth: '200px',
                    zIndex: 1000,
                    marginTop: '8px'
                  }}
                >
                  <button
                    onClick={() => {
                      setShowConversationMenu(false);
                      setShowDeleteConfirmation(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#dc3545',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🗑️ Delete Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
          <div className="messages-container">
            {nextCursor && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <button 
                  onClick={loadMoreMessages} 
                  className="input-action-btn"
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
                </button>
              </div>
            )}

            <div className="messages-list">
              {groupedMessages.map((group, groupIndex) => {
                const isOwn = group.sender_id === (currentUser?.user_id ?? (currentUser as any)?.id);
                const isFirstOfGroup = groupIndex === 0 || groupedMessages[groupIndex - 1].sender_id !== group.sender_id;
                
                return (
                  <div key={groupIndex} className={`message-group ${isOwn ? 'sent' : 'received'}`}>
                    {group.messages.map((message, messageIndex) => {
                      const messageIsOwn = isOwnMessage(message);
                      // Show avatar on the last message of the group (last consecutive message from sender)
                      const isLastInGroup = messageIndex === group.messages.length - 1;
                      const showAvatar = isLastInGroup && !messageIsOwn;
                      
                      return (
                        <div 
                          key={message.id} 
                          className={`message-item ${isOwn ? 'sent' : 'received'}`} 
                          style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px', marginBottom: '8px', position: 'relative' }}
                          onMouseEnter={(e) => {
                            // Show action buttons for both own and received messages
                            const actionButtons = e.currentTarget.querySelector('.message-actions') as HTMLElement;
                            if (actionButtons) {
                              actionButtons.style.opacity = '1';
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Hide action buttons when leaving the message
                            const actionButtons = e.currentTarget.querySelector('.message-actions') as HTMLElement;
                            if (actionButtons && !actionButtons.matches(':hover')) {
                              actionButtons.style.opacity = '0';
                            }
                          }}
                        >
                          {/* Avatar - only show for received messages (not own messages) */}
                          {showAvatar && !messageIsOwn ? (
                            <div
                              className="message-avatar"
                              onClick={() => {
                                if (message.sender_id) {
                                  navigate(`/profile/${message.sender_id}`);
                                }
                              }}
                              title={message.sender_name}
                              style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                overflow: 'hidden',
                                flexShrink: 0,
                                cursor: 'pointer',
                                marginTop: '4px'
                              }}
                            >
                              {getAvatarDisplay(message)}
                            </div>
                          ) : (
                            !isOwn && (
                              // For received messages, show avatar spacer
                            <div style={{ width: '32px', flexShrink: 0 }} />
                            )
                          )}
                          
                          <div 
                            style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, position: 'relative' }}
                            onMouseEnter={(e) => {
                              // Show action buttons for both own and received messages
                              const actionButtons = e.currentTarget.closest('.message-item')?.querySelector('.message-actions') as HTMLElement;
                              if (actionButtons) {
                                actionButtons.style.opacity = '1';
                              }
                            }}
                            onMouseLeave={(e) => {
                              // Hide action buttons when leaving the message container
                              const actionButtons = e.currentTarget.closest('.message-item')?.querySelector('.message-actions') as HTMLElement;
                              if (actionButtons && !actionButtons.matches(':hover')) {
                                // Small delay to allow moving to buttons
                                setTimeout(() => {
                                  if (actionButtons && !actionButtons.matches(':hover')) {
                                    actionButtons.style.opacity = '0';
                                  }
                                }, 100);
                              }
                            }}
                          >
                            <div 
                              className="message-bubble" 
                              style={{ position: 'relative' }}
                            onMouseEnter={(e) => {
                              // Show action buttons for both own and received messages
                              const actionButtons = e.currentTarget.closest('.message-item')?.querySelector('.message-actions') as HTMLElement;
                              if (actionButtons) {
                                actionButtons.style.opacity = '1';
                              }
                            }}
                            onMouseLeave={(e) => {
                              // Hide action buttons when leaving the message bubble
                              const actionButtons = e.currentTarget.closest('.message-item')?.querySelector('.message-actions') as HTMLElement;
                              if (actionButtons && !actionButtons.matches(':hover')) {
                                actionButtons.style.opacity = '0';
                              }
                            }}
                            >
                              {editingMessageId === message.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <textarea
                                    value={editMessageContent}
                                    onChange={(e) => setEditMessageContent(e.target.value)}
                                    style={{ 
                                      width: '100%', 
                                      minHeight: '60px', 
                                      padding: '8px', 
                                      borderRadius: '8px', 
                                      border: '1px solid #ddd',
                                      resize: 'vertical',
                                      fontFamily: 'inherit',
                                      fontSize: '14px'
                                    }}
                                    autoFocus
                                  />
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditMessageContent('');
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleEditMessage(message.id)}
                                      style={{
                                        padding: '6px 12px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: '#007bff',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Reply Preview */}
                                  {message.reply_to && (
                                    <div style={{
                                      background: isOwn ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      marginBottom: '8px',
                                      borderLeft: `3px solid ${isOwn ? 'rgba(255,255,255,0.5)' : '#007bff'}`,
                                      fontSize: '13px'
                                    }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        color: isOwn ? 'rgba(255,255,255,0.8)' : '#666',
                                        marginBottom: '4px'
                                      }}>
                                        <span style={{ fontSize: '12px' }}>↩️</span>
                                        <span style={{ fontWeight: 600, fontSize: '12px' }}>
                                          {message.reply_to.sender_name}
                                        </span>
                                      </div>
                                      <div style={{ 
                                        color: isOwn ? 'rgba(255,255,255,0.7)' : '#888',
                                        fontSize: '12px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {message.reply_to.content || 'Attachment'}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {message.attachment_url ? (
                                    <div className="attachment-preview">
                                      {message.attachment_info?.file_category === 'image' || isImageFile((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type) ? (
                                        <>
                                          <img 
                                            src={message.attachment_url} 
                                            alt={message.content} 
                                            className="attachment-image"
                                            onClick={() => setLightboxUrl(message.attachment_url!)}
                                          />
                                          <button 
                                            className="attachment-download-btn"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDownloadFile({
                                                url: message.attachment_url!,
                                                name: message.attachment_info?.file_name || 'image'
                                              });
                                            }}
                                            title="Download image"
                                          >
                                            ⬇️ Download
                                          </button>
                                        </>
                                      ) : isVideoFile((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type) ? (
                                        <div className="video-attachment">
                                          <video
                                            controls
                                            className="attachment-video"
                                            onPlay={() => setPlayingVideoId(message.id)}
                                            onPause={() => setPlayingVideoId(null)}
                                          >
                                            <source src={message.attachment_url} type="video/mp4" />
                                            Your browser does not support the video tag.
                                          </video>
                                          <div className="video-filename">
                                            {message.attachment_info?.file_name || message.content}
                                          </div>
                                        </div>
                                      ) : (
                                        <div 
                                          className="attachment-file"
                                          onClick={() => setDownloadFile({
                                            url: message.attachment_url!,
                                            name: message.attachment_info?.file_name || message.content
                                          })}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          <span className="file-icon">
                                            {getFileIcon((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type)}
                                          </span>
                                          <div className="file-info">
                                            <div className="file-name">
                                              {message.attachment_info?.file_name || message.content}
                                            </div>
                                            {message.attachment_info?.file_size && (
                                              <div className="file-size">
                                                {formatFileSize(message.attachment_info.file_size)}
                                              </div>
                                            )}
                                          </div>
                                          <span className="download-icon">⬇️</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="message-text">
                                      {renderTextWithLinks(message.content, { color: isOwn ? '#ffffff' : '#050505' })}
                                      {message.is_edited && (
                                        <span style={{
                                          fontSize: '11px',
                                          color: isOwn ? 'rgba(255,255,255,0.6)' : '#888',
                                          fontStyle: 'italic',
                                          marginLeft: '8px'
                                        }}>
                                          (edited)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Reaction Picker - Positioned dynamically to prevent clipping */}
                                  {reactionPickerMessageId === message.id && reactionPickerPosition && (
                                    <div 
                                      className="reaction-picker"
                                      style={{
                                        position: 'fixed', 
                                        left: `${reactionPickerPosition.x}px`,
                                        top: `${reactionPickerPosition.y}px`,
                                        zIndex: 10000,
                                        background: 'white',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        padding: '8px',
                                        display: 'flex',
                                        gap: '4px',
                                        whiteSpace: 'nowrap'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {['😊', '❤️', '👍', '😂', '😮', '😢'].map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const currentUserId = currentUser?.user_id ?? (currentUser as any)?.id ?? 0;
                                            const messageId = message.id;
                                            const existing = messageReactions[messageId] || [];
                                            const sameReaction = existing.find(r => r.userId === currentUserId && r.emoji === emoji);
                                            const previousReaction = existing.find(r => r.userId === currentUserId && r.emoji !== emoji);

                                            const sendReactionUpdate = (action: 'add' | 'remove', emojiValue: string) => {
                                              if (wsRef.current) {
                                                wsRef.current.send({
                                                  type: 'reaction',
                                                  message_id: parseInt(messageId),
                                                  emoji: emojiValue,
                                                  action
                                                });
                                                console.log(`[Reaction] Sent via WebSocket: ${action} ${emojiValue} on message ${messageId}`);
                                              }
                                            };

                                            if (sameReaction) {
                                              // Remove existing reaction (toggle off)
                                              sendReactionUpdate('remove', emoji);
                                              setMessageReactions(prev => {
                                                const existingReactions = prev[messageId] || [];
                                                const updated = existingReactions.filter(r => !(r.userId === currentUserId && r.emoji === emoji));
                                                if (updated.length === 0) {
                                                  const newState = { ...prev };
                                                  delete newState[messageId];
                                                  return newState;
                                                }
                                                return { ...prev, [messageId]: updated };
                                              });
                                            } else {
                                              // If user already reacted with another emoji, remove it first
                                              if (previousReaction) {
                                                sendReactionUpdate('remove', previousReaction.emoji);
                                              }

                                              sendReactionUpdate('add', emoji);

                                              setMessageReactions(prev => {
                                                const existingReactions = prev[messageId] || [];
                                                const filtered = existingReactions.filter(r => r.userId !== currentUserId);
                                                const updated = [...filtered, { emoji, userId: currentUserId }];
                                                return { ...prev, [messageId]: updated };
                                              });
                                            }
                                            setReactionPickerMessageId(null);
                                            setReactionPickerPosition(null);
                                          }}
                                          style={{
                                            width: '32px',
                                            height: '32px',
                                            border: 'none',
                                            borderRadius: '50%',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '20px',
                                            padding: 0
                                          }}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Display Reactions */}
                                  {(() => {
                                    const reactions = messageReactions[message.id];
                                    if (reactions && reactions.length > 0) {
                                      console.log('Displaying reactions for message:', message.id, reactions);
                                      return (
                                        <div 
                                          style={{
                                            position: 'absolute',
                                            bottom: '-32px',
                                            right: isOwn ? 'auto' : '8px',
                                            left: isOwn ? '8px' : 'auto',
                                      display: 'flex', 
                                            gap: '4px',
                                            alignItems: 'center',
                                            background: 'rgba(0,0,0,0.05)',
                                            borderRadius: '12px',
                                            padding: '2px 6px',
                                            fontSize: '12px',
                                            zIndex: 10
                                          }}
                                        >
                                          {Object.entries(
                                            reactions.reduce((acc, r) => {
                                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                              return acc;
                                            }, {} as Record<string, number>)
                                          ).map(([emoji, count]) => (
                                            <span key={emoji} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                              {emoji} {count > 1 && <span>{count}</span>}
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </>
                              )}
                            </div>
                            
                            {/* Action buttons for received messages (on the RIGHT side) */}
                            {!messageIsOwn && (
                              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', position: 'absolute', right: '-90px', top: '0' }}>
                                {/* Message actions: Reactions, Reply (for received messages) */}
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'row',
                                      gap: '4px',
                                      opacity: 0,
                                      transition: 'opacity 0.2s'
                                    }} 
                                    className="message-actions"
                                    onMouseEnter={(e) => {
                                      const target = e.currentTarget;
                                      target.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                      const target = e.currentTarget;
                                  // Only hide if mouse is not over the message bubble
                                  const messageItem = target.closest('.message-item');
                                  const messageBubble = messageItem?.querySelector('.message-bubble');
                                  if (!messageBubble?.matches(':hover') && !messageItem?.matches(':hover')) {
                                      target.style.opacity = '0';
                                  }
                                    }}
                                    >
                                  {/* Reply Button - Messenger Style */}
                                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReplyingToMessageId(message.id);
                                      inputRef.current?.focus();
                                        }}
                                        className="message-action-btn"
                                        style={{
                                      width: '32px',
                                      height: '32px',
                                      border: 'none',
                                      borderRadius: '50%',
                                      background: 'rgba(0, 0, 0, 0.05)',
                                          cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                      e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    title="Reply"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M10 9V5L3 12L10 19V14.9C15 14.9 18.5 16.5 21 20C20 15 17 10 10 9Z" fill="currentColor" fillOpacity="0.7"/>
                                    </svg>
                                      </button>
                                  
                                  {/* Emoji Reaction Button - Messenger Style */}
                                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const messageItem = e.currentTarget.closest('.message-item') as HTMLElement;
                                      if (messageItem) {
                                        const itemRect = messageItem.getBoundingClientRect();
                                        const messageBubble = messageItem.querySelector('.message-bubble') as HTMLElement;
                                        const bubbleRect = messageBubble ? messageBubble.getBoundingClientRect() : itemRect;
                                        
                                        // Position picker above the message bubble, but adjust if near top of viewport
                                        const pickerHeight = 50; // Approximate height of picker
                                        const pickerWidth = 250; // Approximate width of picker
                                        const spaceAbove = bubbleRect.top;
                                        const spaceBelow = window.innerHeight - bubbleRect.bottom;
                                        
                                        let y: number;
                                        if (spaceAbove < pickerHeight + 10 && spaceBelow > pickerHeight + 10) {
                                          // Not enough space above, position below
                                          y = bubbleRect.bottom + 5;
                                        } else {
                                          // Position above
                                          y = bubbleRect.top - pickerHeight - 5;
                                        }
                                        
                                        // Ensure it doesn't go off screen vertically
                                        y = Math.max(10, Math.min(y, window.innerHeight - pickerHeight - 10));
                                        
                                        // Calculate horizontal position - center it relative to the message bubble
                                        let x: number;
                                        if (isOwn) {
                                          // For own messages, align to right side of bubble
                                          x = bubbleRect.right - (pickerWidth / 2);
                                        } else {
                                          // For received messages, align to left side of bubble
                                          x = bubbleRect.left + (pickerWidth / 2);
                                        }
                                        
                                        // Ensure it doesn't go off screen horizontally
                                        x = Math.max(pickerWidth / 2 + 10, Math.min(x, window.innerWidth - pickerWidth / 2 - 10));
                                        
                                        setReactionPickerPosition({
                                          x: x,
                                          y: y,
                                          isOwn: isOwn
                                        });
                                        setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                      } else {
                                        setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                        setReactionPickerPosition(null);
                                      }
                                    }}
                                        className="message-action-btn"
                                        style={{
                                      width: '32px',
                                      height: '32px',
                                      border: 'none',
                                      borderRadius: '50%',
                                      background: 'rgba(0, 0, 0, 0.05)',
                                          cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                      e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    title="Add reaction"
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ opacity: 0.7 }}/>
                                      <circle cx="9" cy="10" r="1.5" fill="currentColor" style={{ opacity: 0.7 }}/>
                                      <circle cx="15" cy="10" r="1.5" fill="currentColor" style={{ opacity: 0.7 }}/>
                                      <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" style={{ opacity: 0.7 }}/>
                                    </svg>
                                      </button>
                                </div>
                                    </div>
                                  )}
                            
                            {/* Context Menu for own messages */}
                            {contextMenuMessageId === message.id && contextMenuPosition && (
                              <div 
                                className="message-context-menu"
                                style={{
                                  position: 'fixed',
                                  top: `${contextMenuPosition.y}px`,
                                  left: `${contextMenuPosition.x}px`,
                                  zIndex: 2000,
                                  background: 'white',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  padding: '8px 0',
                                  minWidth: '120px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingMessageId(message.id);
                                    setEditMessageContent(message.content);
                                    setContextMenuMessageId(null);
                                    setContextMenuPosition(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    color: '#333'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f8f9fa';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMessage(message.id);
                                    setContextMenuMessageId(null);
                                    setContextMenuPosition(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    color: '#dc3545'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f8f9fa';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  Delete
                                </button>
                            </div>
                            )}
                            
                            {messageIndex === group.messages.length - 1 && (
                              <div 
                                className="message-time" 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  marginTop: (messageReactions[message.id] && messageReactions[message.id].length > 0) ? '40px' : '4px', 
                                  fontSize: '11px', 
                                  color: '#999' 
                                }}
                              >
                                {formatTime(message.created_at)}
                                {isOwn && (
                                  <div className="message-status">
                                    <span className="status-icon delivered">✓✓</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* For own messages: Action buttons on LEFT (placed after message content for row-reverse) */}
                          {isOwn && (
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                              {/* Message actions: Reactions, Reply, Menu (for own messages) */}
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'row',
                                gap: '4px',
                                opacity: 0,
                                transition: 'opacity 0.2s'
                              }} 
                              className="message-actions"
                              onMouseEnter={(e) => {
                                const target = e.currentTarget;
                                target.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                const target = e.currentTarget;
                                const messageItem = target.closest('.message-item');
                                const messageBubble = messageItem?.querySelector('.message-bubble');
                                if (!messageBubble?.matches(':hover') && !messageItem?.matches(':hover')) {
                                  target.style.opacity = '0';
                                }
                              }}
                              >
                                {/* Three-dot Menu (for own messages) - Messenger Style */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setContextMenuMessageId(message.id);
                                    setContextMenuPosition({
                                      x: rect.right,
                                      y: rect.top
                                    });
                                  }}
                                  className="message-action-btn"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    border: 'none',
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.05)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                  title="More options"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="6" r="1.5" fill="currentColor" fillOpacity="0.7"/>
                                    <circle cx="12" cy="12" r="1.5" fill="currentColor" fillOpacity="0.7"/>
                                    <circle cx="12" cy="18" r="1.5" fill="currentColor" fillOpacity="0.7"/>
                                  </svg>
                                </button>
                                
                                {/* Reply Button - Messenger Style */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingToMessageId(message.id);
                                    inputRef.current?.focus();
                                  }}
                                  className="message-action-btn"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    border: 'none',
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.05)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                  title="Reply"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 9V5L3 12L10 19V14.9C15 14.9 18.5 16.5 21 20C20 15 17 10 10 9Z" fill="currentColor" fillOpacity="0.7"/>
                                  </svg>
                                </button>
                                
                                  {/* Emoji Reaction Button - Messenger Style */}
                                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const messageItem = e.currentTarget.closest('.message-item') as HTMLElement;
                                      if (messageItem) {
                                        const messageBubble = messageItem.querySelector('.message-bubble') as HTMLElement;
                                        if (!messageBubble) return;
                                        
                                        const bubbleRect = messageBubble.getBoundingClientRect();
                                        
                                        // Position picker above the message bubble, but adjust if near top of viewport
                                        const pickerHeight = 50; // Approximate height of picker
                                        const pickerWidth = 220; // Approximate width of picker (6 emojis + padding)
                                        const spaceAbove = bubbleRect.top;
                                        const spaceBelow = window.innerHeight - bubbleRect.bottom;
                                        
                                        let y: number;
                                        if (spaceAbove < pickerHeight + 10 && spaceBelow > pickerHeight + 10) {
                                          // Not enough space above, position below
                                          y = bubbleRect.bottom + 5;
                                        } else {
                                          // Position above
                                          y = bubbleRect.top - pickerHeight - 5;
                                        }
                                        
                                        // Ensure it doesn't go off screen vertically
                                        y = Math.max(10, Math.min(y, window.innerHeight - pickerHeight - 10));
                                        
                                        // Calculate horizontal position - align to the side of the bubble
                                        let x: number;
                                        if (isOwn) {
                                          // For own messages, align to right edge of bubble
                                          x = bubbleRect.right;
                                        } else {
                                          // For received messages, align to left edge of bubble
                                          x = bubbleRect.left;
                                        }
                                        
                                        // Adjust to keep picker on screen
                                        if (x + pickerWidth > window.innerWidth - 10) {
                                          x = window.innerWidth - pickerWidth - 10;
                                        }
                                        if (x < 10) {
                                          x = 10;
                                        }
                                        
                                        setReactionPickerPosition({
                                          x: x,
                                          y: y,
                                          isOwn: isOwn
                                        });
                                        setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                      } else {
                                        setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                        setReactionPickerPosition(null);
                                      }
                                    }}
                                  className="message-action-btn"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    border: 'none',
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.05)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                  title="Add reaction"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.7"/>
                                    <circle cx="9" cy="10" r="1.5" fill="currentColor" opacity="0.7"/>
                                    <circle cx="15" cy="10" r="1.5" fill="currentColor" opacity="0.7"/>
                                    <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="typing-text">
                    {Array.from(typingUsers).map(userId => {
                      // Check if it's the other participant
                      if (conversation.other_participant?.user_id === userId) {
                        return conversation.other_participant.name;
                      }
                      return 'Someone';
                    }).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

        {/* Input Area */}
        <div className="input-container">
            {/* Reply Preview */}
            {replyingToMessageId && (() => {
              const repliedMessage = messages.find(m => m.id === replyingToMessageId);
              if (!repliedMessage) return null;
              
              return (
                <div style={{
                  padding: '8px 12px',
                  background: '#f0f0f0',
                  borderTop: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#666'
                }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#333' }}>↩️ Replying to {repliedMessage.sender_name}:</span>
                    <span style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      maxWidth: '300px'
                    }}>
                      {repliedMessage.content || 'Attachment'}
                    </span>
                  </div>
                  <button
                    onClick={() => setReplyingToMessageId(null)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '0',
                      color: '#999'
                    }}
                    title="Cancel reply"
                  >
                    ×
                  </button>
                </div>
              );
            })()}
            
            <div className="input-wrapper">
              <div className="input-actions">
                <button 
                  type="button"
                  className="input-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  📎
                </button>
                <button 
                  type="button"
                  className="input-action-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  title="Emoji"
                >
                  😊
                </button>
              </div>
              
              <textarea
                ref={inputRef}
                className="message-input"
                placeholder={replyingToMessageId ? "Type a reply..." : "Type a message..."}
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '20px',
                  maxHeight: '120px',
                }}
              />
              
              <div className="input-actions">
                <button 
                  className={`input-action-btn ${inputValue.trim() ? 'primary' : ''}`}
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  title="Send message"
                >
                  ➤
                </button>
              </div>
            </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div 
            className="emoji-picker-container"
            style={{
              position: 'absolute',
              bottom: '200px',
              left: '20px',
              zIndex: 1000,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#fff',
              border: '1px solid #e0e0e0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={350}
              height={400}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
            />
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.mp3,.mp4,.wav,.ogg,.avi,.mov"
          onChange={async () => {
            const inputEl = fileInputRef.current;
            const file = inputEl?.files?.[0] || null;
            if (!file || !conversation) return;
            
            try {
              const uploaded = await uploadAttachment(file);
              
              let messageType: 'image' | 'file' = 'file';
              let messageContent = uploaded.file_name;
              
              switch (uploaded.file_category) {
                case 'image':
                  messageType = 'image';
                  messageContent = '📷 Image';
                  break;
                case 'pdf':
                  messageContent = '📄 PDF Document';
                  break;
                case 'word':
                  messageContent = '📝 Word Document';
                  break;
                case 'excel':
                  messageContent = '📊 Excel Spreadsheet';
                  break;
                case 'powerpoint':
                  messageContent = '📈 PowerPoint Presentation';
                  break;
                case 'video':
                  messageContent = '🎥 Video File';
                  break;
                case 'audio':
                  messageContent = '🎵 Audio File';
                  break;
                case 'archive':
                  messageContent = '📦 Archive File';
                  break;
                case 'text':
                  messageContent = '📄 Text Document';
                  break;
                default:
                  messageContent = `📎 ${uploaded.file_name}`;
              }
              
              const saved = await sendMessage(conversation.conversation_id, { 
                content: messageContent, 
                message_type: messageType, 
                attachment_id: uploaded.attachment_id 
              });
              
              const attachmentMessage: UiMessage = {
                id: String(saved.message_id),
                content: saved.content,
                sender_id: saved.sender.user_id,
                sender_name: saved.sender.name,
                sender_avatar: saved.sender.avatar_url || null,
                created_at: saved.created_at,
                is_read: saved.is_read,
                message_type: (saved as any).message_type,
                attachment_url: (() => {
                  const fromSaved = (saved as any).attachments && (saved as any).attachments[0]?.file_url;
                  const url = fromSaved || (uploaded as any).file_url || null;
                  if (!url) return null;
                  
                  try {
                    const urlObj = new URL(url);
                    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                      return url;
                    }
                  } catch {
                    if (!url.startsWith('http')) {
                      return `${window.location.origin}${url}`;
                    }
                  }
                  return null;
                })(),
                attachment_info: {
                  file_name: uploaded.file_name,
                  file_type: uploaded.file_type,
                  file_category: uploaded.file_category as FileCategory,
                  file_size: uploaded.file_size,
                },
              };
              
              setMessages(prev => addMessageWithDeduplication(prev, attachmentMessage));
          // Delay scroll to ensure messages are rendered
        setTimeout(() => {
          requestAnimationFrame(scrollToBottom);
        }, 200);
            } catch (err) {
              console.error('Attachment send failed:', err);
              alert('Failed to upload attachment. Please try again.');
            } finally {
              if (inputEl) inputEl.value = '';
            }
          }}
        />

        {/* Image Lightbox */}
        {lightboxUrl && (
          <div 
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0,0,0,0.9)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 1000, 
              cursor: 'zoom-out'
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={lightboxUrl}
                alt="Preview"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: '96vw', 
                  maxHeight: '96vh', 
                  borderRadius: 8,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.4)'
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDownloadFile({ url: lightboxUrl, name: 'image.jpg' });
                }}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  padding: '12px 24px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Download image"
              >
                ⬇️ Download
              </button>
            </div>
          </div>
        )}

        {/* Download Confirmation Modal */}
        {downloadFile && (
          <div 
            style={{
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 1001,
              padding: '20px'
            }}
            onClick={() => setDownloadFile(null)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: '24px',
                maxWidth: '400px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>
                Download File
              </h3>
              <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '14px' }}>
                Do you want to download <strong>{downloadFile.name}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDownloadFile(null)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Fetch the file as a blob to ensure proper download
                      const response = await fetch(downloadFile.url);
                      if (!response.ok) {
                        throw new Error('Failed to fetch file');
                      }
                      const blob = await response.blob();
                      
                      // Create a blob URL and download
                      const blobUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = downloadFile.name;
                      document.body.appendChild(link);
                      link.click();
                      
                      // Clean up
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                      setDownloadFile(null);
                    } catch (error) {
                      console.error('Download error:', error);
                      alert('Failed to download file. Please try again.');
                      setDownloadFile(null);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#007bff',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirmation && (
          <div 
            onClick={() => setShowDeleteConfirmation(false)}
            style={{
              position: 'fixed', 
              inset: 0, 
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 1001
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '24px',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600, color: '#333' }}>
                Delete Conversation?
              </h3>
              <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                Are you sure you want to delete this conversation with <strong>{conversation?.other_participant?.name || 'this user'}</strong>?
                <br /><br />
                This action cannot be undone. All messages will be removed from your inbox.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  disabled={isDeletingConversation}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#333',
                    cursor: isDeletingConversation ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: isDeletingConversation ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConversation}
                  disabled={isDeletingConversation}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#dc3545',
                    color: 'white',
                    cursor: isDeletingConversation ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: isDeletingConversation ? 0.6 : 1
                  }}
                >
                  {isDeletingConversation ? 'Deleting...' : 'Delete Conversation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WebSocketErrorBoundary>
  );
};

export default ModernChatInterface;
