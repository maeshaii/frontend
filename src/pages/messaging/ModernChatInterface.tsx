import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageItem, 
  ConversationSummary, 
  listMessages, 
  sendMessage, 
  markConversationRead,
  getUserInfo,
  uploadAttachment,
  deleteMessageApi,
  updateMessageApi,
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
  const [messageReactions, setMessageReactions] = useState<{[key: string]: Array<{emoji: string, userId: number}>}>({});
  const [contextMenuMessageId, setContextMenuMessageId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
  
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
        }
      }
    };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [showEmojiPicker, contextMenuMessageId, reactionPickerMessageId]);

  // Fetch profile picture from API (similar to notifications) - MUST BE DEFINED BEFORE loadMessages
  const fetchUserProfilePic = useCallback(async (userId: number | string): Promise<string | null> => {
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
      }));

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
        if (!uniqueSenders.has(msg.sender_id) && !loadedProfilePics.current.has(String(msg.sender_id))) {
          uniqueSenders.add(msg.sender_id);
          fetchUserProfilePic(msg.sender_id);
        }
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation, scrollToBottom, fetchUserProfilePic]);

  const connectWebSocket = useCallback(async () => {
    if (!conversation || isConnecting) return;

    // Disconnect existing WebSocket first
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    setIsConnecting(true);

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
        setConnectionStatus(status);
        if (status === 'connected' && !hasMarkedRef.current) {
          markConversationRead(conversation.conversation_id).catch(() => {});
          hasMarkedRef.current = true;
          setHasMarkedAsRead(true);
          // Optimistically broadcast to parent/other UI that unread is now zero
          window.dispatchEvent(new CustomEvent('conversationRead', { detail: { conversationId: conversation.conversation_id } }));
        }
      };

      const messageCallback = (event: WsEvent) => {
        const myId = currentUser?.user_id ?? (currentUser as any)?.id;
        switch (event.type) {
          case 'message':
            // Handle nested message structure from WebSocket
            const messageData = event.message || event;
            if (messageData.sender_id === myId) break;
            
            console.log('Received WebSocket message:', messageData); // Debug log
            console.log('Message content:', messageData.content); // Debug log
            
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
  }, [conversation, currentUser, scrollToBottom, isConnecting]);

  useEffect(() => {
    if (conversation) {
      setMessages([]);
      setNextCursor(null);
      setHasMarkedAsRead(false);
      hasMarkedRef.current = false;
      setTypingUsers(new Set());
      loadMessages();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversation, loadMessages, connectWebSocket]);

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

      // If replying to a message, format the reply with the original message info
      if (replyingToMessageId) {
        const repliedMessage = messages.find(m => m.id === replyingToMessageId);
        if (repliedMessage) {
          // Format: "Replying to [name]: [original message]\n\n[your reply]"
          const originalContent = repliedMessage.content || 'Attachment';
          const truncatedOriginal = originalContent.length > 50 
            ? originalContent.substring(0, 50) + '...' 
            : originalContent;
          sanitizedText = `↩️ Replying to ${repliedMessage.sender_name}: ${truncatedOriginal}\n\n${sanitizedText}`;
        }
      }

      const tempId = Date.now().toString();
      const tempMessage: UiMessage = {
        id: tempId,
        content: sanitizedText,
        sender_id: currentUser?.user_id || 0,
        sender_name: currentUser?.full_name || 'You',
        sender_avatar: currentUser?.profile_pic || currentUser?.avatar_url || null,
        created_at: new Date().toISOString(),
        is_read: false,
        tempId,
        reply_to: replyingToMessageId || undefined,
      };

      setMessages(prev => addMessageWithDeduplication(prev, tempMessage));
      setInputValue('');
      setReplyingToMessageId(null); // Clear reply state after sending
      
      typingIndicatorRef.current?.sendTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      try {
        console.log('Sending to API:', { content: sanitizedText, message_type: 'text' }); // Debug log
        const saved = await sendMessage(conversation.conversation_id, { content: sanitizedText, message_type: 'text' });
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
    
    // Fetch profile picture if we don't have it yet
    if (!avatarUrl && !loadedProfilePics.current.has(senderIdStr)) {
      fetchUserProfilePic(message.sender_id);
    }
    
    if (avatarUrl) {
      // Add cache-busting parameter
      const separator = avatarUrl.includes('?') ? '&' : '?';
      const urlWithBust = `${avatarUrl}${separator}cb=${Date.now()}`;
      
      return (
        <img 
          src={urlWithBust} 
          alt={message.sender_name}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px; border-radius: 50%;">${initial}</div>`;
            }
          }}
        />
      );
    }
    
    return <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '14px', borderRadius: '50%' }}>{initial}</div>;
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

  if (!conversation) {
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
                
                // Check cache first
                let avatarUrl: string | null = null;
                if (otherUserIdStr && userProfilePics[otherUserIdStr]) {
                  avatarUrl = userProfilePics[otherUserIdStr];
                }
                // Try conversation other_participant avatar_url
                else if ((otherParticipant as any)?.avatar_url) {
                  avatarUrl = getProfilePicUrl((otherParticipant as any).avatar_url);
                }
                
                // Fetch profile picture if we don't have it yet
                if (!avatarUrl && otherUserIdStr && otherUserId && !loadedProfilePics.current.has(otherUserIdStr)) {
                  fetchUserProfilePic(otherUserId);
                }
                
                if (avatarUrl) {
                  const separator = avatarUrl.includes('?') ? '&' : '?';
                  const urlWithBust = `${avatarUrl}${separator}cb=${Date.now()}`;
                  
                  return (
                    <img 
                      src={urlWithBust} 
                      alt={otherParticipant?.name || 'User'}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.textContent = initial;
                        }
                      }}
                    />
                  );
                }
                return initial;
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
              <p className="chat-header-status">
                {connectionStatus === 'connected' ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="chat-action-btn" title="Voice Call">
                📞
              </button>
              <button className="chat-action-btn" title="Video Call">
                📹
              </button>
              <button className="chat-action-btn" title="More Options">
                ⋯
              </button>
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
                                    </div>
                                  )}
                                  
                                  {/* Reaction Picker */}
                                  {reactionPickerMessageId === message.id && (
                                    <div 
                                      className="reaction-picker"
                                      style={{
                                      position: 'absolute', 
                                        left: isOwn ? 'auto' : '-60px',
                                        right: isOwn ? '-60px' : 'auto',
                                        top: '0',
                                        zIndex: 1000,
                                        background: 'white',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        padding: '8px',
                                        display: 'flex',
                                        gap: '4px'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {['😊', '❤️', '👍', '😂', '😮', '😢'].map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const userId = currentUser?.user_id ?? (currentUser as any)?.id;
                                            setMessageReactions(prev => {
                                              const messageId = message.id;
                                              const existing = prev[messageId] || [];
                                              const existingReactionIndex = existing.findIndex(r => r.userId === userId && r.emoji === emoji);
                                              
                                              if (existingReactionIndex >= 0) {
                                                // Remove reaction
                                                const updated = [...existing];
                                                updated.splice(existingReactionIndex, 1);
                                                if (updated.length === 0) {
                                                  const newReactions = { ...prev };
                                                  delete newReactions[messageId];
                                                  console.log('Reaction removed, state:', newReactions);
                                                  return newReactions;
                                                }
                                                console.log('Reaction removed (still others), state:', { ...prev, [messageId]: updated });
                                                return { ...prev, [messageId]: updated };
                                              } else {
                                                // Add reaction
                                                const newState = { ...prev, [messageId]: [...existing, { emoji, userId: userId || 0 }] };
                                                console.log('Reaction added, messageId:', messageId, 'emoji:', emoji, 'state:', newState);
                                                return newState;
                                              }
                                            });
                                            setReactionPickerMessageId(null);
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
                                  {/* Reply Button */}
                                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReplyingToMessageId(message.id);
                                      inputRef.current?.focus();
                                        }}
                                        style={{
                                      width: '28px',
                                      height: '28px',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '50%',
                                      background: 'white',
                                          cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      padding: 0,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      lineHeight: '1'
                                    }}
                                    title="Reply"
                                  >
                                    ↩️
                                      </button>
                                  
                                  {/* Emoji Reaction Button */}
                                      <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                    }}
                                        style={{
                                      width: '28px',
                                      height: '28px',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '50%',
                                      background: 'white',
                                          cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      padding: 0,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      lineHeight: '1'
                                    }}
                                    title="Add reaction"
                                  >
                                    😊
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
                                  Remove
                                </button>
                            </div>
                            )}
                            
                            {messageIndex === group.messages.length - 1 && (
                              <div className="message-time" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#999' }}>
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
                                {/* Three-dot Menu (for own messages) */}
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
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '50%',
                                    background: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    padding: 0,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    lineHeight: '1'
                                  }}
                                  title="More options"
                                >
                                  ⋯
                                </button>
                                
                                {/* Reply Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingToMessageId(message.id);
                                    inputRef.current?.focus();
                                  }}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '50%',
                                    background: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    padding: 0,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    lineHeight: '1'
                                  }}
                                  title="Reply"
                                >
                                  ↩️
                                </button>
                                
                                {/* Emoji Reaction Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                  }}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '50%',
                                    background: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    padding: 0,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    lineHeight: '1'
                                  }}
                                  title="Add reaction"
                                >
                                  😊
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
      </div>
    </WebSocketErrorBoundary>
  );
};

export default ModernChatInterface;
