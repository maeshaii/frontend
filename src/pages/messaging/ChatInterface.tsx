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
  api
} from '../../services/api';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';
import { getConversationWsUrl } from '../../services/api';
import { getFileIcon, getFileTypeDisplayName, formatFileSize, isImageFile, isVideoFile, isAudioFile, canPreview, FileCategory } from '../../utils/fileUtils';
import { deduplicateMessages, addMessageWithDeduplication, replaceTempMessage, removeTempMessage, isDuplicateMessage, sortMessagesBySequence, detectSequenceGaps, UiMessage } from '../../utils/messageUtils';
import { sanitizeUserInput, validateMessageType } from '../../utils/securityUtils';
import { WebSocketErrorBoundary } from '../../components/ErrorBoundary';
import { useLogger } from '../../utils/logger';
import './Messaging.css';

interface ChatInterfaceProps {
  conversation: ConversationSummary | null;
  onBack?: () => void;
}


const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversation, onBack }) => {
  const logger = useLogger('ChatInterface');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const hasMarkedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const typingIndicatorRef = useRef<TypingIndicator | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize current user
  useEffect(() => {
    const initUser = async () => {
      try {
        const user = await getUserInfo();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to get user info:', error);
      }
    };
    initUser();
  }, []);

  const loadMessages = useCallback(async (cursor?: string) => {
    if (!conversation) return;
    
    try {
      const data = await listMessages(conversation.conversation_id, { cursor, limit: 50 });
      const mapped: UiMessage[] = data.results.map((m: MessageItem) => ({
        id: String(m.message_id),
        content: m.content,
        sender_id: m.sender.user_id,
        sender_name: m.sender.name,
        created_at: m.created_at,
        is_read: m.is_read,
        message_type: (m as any).message_type,
        attachment_url: (() => {
          const attachment = ((m as any).attachments && (m as any).attachments[0]);
          if (!attachment) return null;
          
          // Try file_url first, then fallback to file field
          const url = attachment.file_url || attachment.file || null;
          if (!url) return null;
          
          // Ensure absolute URL
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
        if (!cursor) setTimeout(scrollToBottom, 100);
        return unique;
      });
      
      setNextCursor(data.next_cursor ?? null);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation, scrollToBottom]);

  const connectWebSocket = useCallback(async () => {
    if (!conversation) return;

    try {
      // Establish session before WebSocket connection
      await api.get('csrf/'); // This will set session cookies
      
      // Get JWT token for WebSocket authentication (fallback)
      let token = null;
      try {
        // Try to get token from localStorage (check the correct key used by login system)
        token = localStorage.getItem('accessToken') || 
                localStorage.getItem('access_token') || 
                localStorage.getItem('token') || 
                localStorage.getItem('jwt_token') ||
                localStorage.getItem('auth_token');
        
        // Debug: Log what tokens we found
        logger.info('Available localStorage keys:', Object.keys(localStorage));
        logger.info('Found token:', token ? 'Yes' : 'No');
        
        if (!token) {
          // Try to refresh token if we have a refresh token
          const refreshToken = localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token');
          if (refreshToken) {
            logger.info('Attempting token refresh...');
            try {
              const tokenResponse = await api.post('token/refresh/', {
                refresh: refreshToken
              });
              token = tokenResponse.data.access;
              localStorage.setItem('accessToken', token);
              logger.info('Token refreshed successfully');
            } catch (refreshError) {
              logger.warn('Token refresh failed, will use session auth', refreshError);
            }
          } else {
            logger.info('No refresh token found, will use session-based authentication');
          }
        }
      } catch (error) {
        // If we can't get a token, try without it (session-based auth)
        logger.warn('Could not get JWT token for WebSocket, using session auth', error);
      }
      
      const wsUrl = getConversationWsUrl(conversation.conversation_id, token || undefined);
      const ws = new ConversationWebSocket(wsUrl);
      wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws, conversation.conversation_id);
    typingIndicatorRef.current = typingIndicator;

    // Create callback functions that can be properly cleaned up
    const statusCallback = (status: any) => {
      setConnectionStatus(status);
      if (status === 'connected' && !hasMarkedRef.current) {
        markConversationRead(conversation.conversation_id).catch(() => {});
        hasMarkedRef.current = true;
        setHasMarkedAsRead(true);
      }
    };

    const messageCallback = (event: WsEvent) => {
      const myId = currentUser?.user_id ?? (currentUser as any)?.id;
      switch (event.type) {
        case 'message':
          // If this is our own echo via websocket, skip because REST already updated UI
          if (event.sender_id === myId) break;
          
          const newMessage: UiMessage = {
            id: String(event.message_id),
            content: event.content || '',
            sender_id: event.sender_id || 0,
            sender_name: event.sender_name || '',
            created_at: event.created_at || new Date().toISOString(),
            is_read: false,
            message_type: event.message_type,
            attachment_url: event.attachment_url || (event.attachments && event.attachments[0]?.file_url),
            attachment_info: event.attachment_info || (event.attachments && event.attachments[0] ? {
              file_name: event.attachments[0].file_name,
              file_type: event.attachments[0].file_type,
              file_category: event.attachments[0].file_category,
              file_size: event.attachments[0].file_size,
            } : undefined),
          };
          
          setMessages(prev => {
            // Check if this is a duplicate before adding
            if (isDuplicateMessage(prev, newMessage)) {
              return prev;
            }
            return addMessageWithDeduplication(prev, newMessage);
          });
          setTimeout(scrollToBottom, 100);
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
          // Handle read receipts if needed
          break;
      }
    };

    // Add callbacks
    ws.onStatus(statusCallback);
    ws.onMessage(messageCallback);

      ws.connect();
        } catch (error) {
          logger.error('Failed to establish session for WebSocket', error);
        }
  }, [conversation, currentUser, scrollToBottom]);

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
      // Clean up WebSocket callbacks to prevent memory leaks
      if (wsRef.current) {
        // Note: We would need to store callback references to remove them properly
        // For now, we'll just disconnect
        wsRef.current.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversation, loadMessages, connectWebSocket]);

  const handleSend = async () => {
    try {
      // Sanitize input on client side as first line of defense
      const sanitizedText = sanitizeUserInput(inputValue.trim());
      if (!sanitizedText || !conversation) return;

      const tempId = Date.now().toString();
      const tempMessage: UiMessage = {
        id: tempId,
        content: sanitizedText,
        sender_id: currentUser?.user_id || 0,
        sender_name: currentUser?.full_name || 'You',
        created_at: new Date().toISOString(),
        is_read: false,
        tempId,
      };

    setMessages(prev => addMessageWithDeduplication(prev, tempMessage));
    setInputValue('');
    
    // Stop typing indicator
    typingIndicatorRef.current?.sendTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

      try {
        const saved = await sendMessage(conversation.conversation_id, { content: sanitizedText, message_type: 'text' });
      
      // Replace temp with saved message using utility function
      const savedMessage: UiMessage = {
        id: String(saved.message_id),
        content: saved.content,
        sender_id: saved.sender.user_id,
        sender_name: saved.sender.name,
        created_at: saved.created_at,
        is_read: saved.is_read,
        message_type: (saved as any).message_type,
        attachment_url: ((saved as any).attachments && (saved as any).attachments[0]?.file_url) || null,
      };
      
        setMessages(prev => replaceTempMessage(prev, tempId, savedMessage));
      } catch (error) {
        logger.error('Send failed', error);
        setMessages(prev => removeTempMessage(prev, tempId));
      }
      
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      logger.error('Input sanitization failed', error);
      // Show user-friendly error message
      alert('Invalid message content. Please check your input and try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputValue(text);
    
    // Send typing indicator
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

  const isOwnMessage = useCallback((message: UiMessage) => {
    const myId = currentUser?.user_id ?? (currentUser as any)?.id;
    return message.sender_id === myId;
  }, [currentUser]);

  // Memoize sorted messages to prevent unnecessary re-renders
  const sortedMessages = useMemo(() => {
    return sortMessagesBySequence(messages);
  }, [messages]);

  // Memoize typing users array to prevent unnecessary re-renders
  const typingUsersArray = useMemo(() => {
    return Array.from(typingUsers);
  }, [typingUsers]);

  // Memoized Message component to prevent unnecessary re-renders
  const MessageComponent = useMemo(() => {
    return React.memo(({ message, idx }: { message: UiMessage; idx: number }) => {
      const own = isOwnMessage(message);
      const prev = idx > 0 ? sortedMessages[idx - 1] : undefined;
      const isFirstOfGroup = !prev || prev.sender_id !== message.sender_id;
      const firstName = (message.sender_name || '').split(' ')[0] || 'Someone';
      
      return (
        <div className={`message ${own ? 'sent' : 'received'}`}>
          <div className="message-content">
            {!own && isFirstOfGroup ? (
              <div
                className="message-avatar"
                onClick={() => {
                  if (message.sender_id) {
                    navigate(`/alumni/profile/${message.sender_id}`);
                  }
                }}
                title={message.sender_name}
              >
                {(firstName[0] || 'U').toUpperCase()}
              </div>
            ) : (!own ? <div className="message-avatar-spacer" /> : null)}

            <div className="message-bubble-container">
              {!own && isFirstOfGroup && (
                <div className="message-header-name">
                  {firstName}
                </div>
              )}
              <div className="message-bubble">
                {message.attachment_url ? (
                  <div className="attachment-preview">
                    {message.attachment_info?.file_category === 'image' || isImageFile((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type) ? (
                      <div>
                        <img 
                          src={message.attachment_url} 
                          alt={message.content} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            if (message.attachment_url) setLightboxUrl(message.attachment_url);
                          }}
                        />
                      </div>
                    ) : message.attachment_info?.file_category === 'video' || isVideoFile((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type) ? (
                      <div>
                        <video 
                          controls 
                          src={message.attachment_url}
                        />
                      </div>
                    ) : message.attachment_info?.file_category === 'audio' || isAudioFile((message.attachment_info?.file_category as FileCategory) || 'document', message.attachment_info?.file_type) ? (
                      <div>
                        <audio 
                          controls 
                          style={{ width: '100%', maxWidth: '240px' }}
                          src={message.attachment_url}
                        />
                      </div>
                    ) : (
                      <div className="file-attachment">
                        <div 
                          className="attachment-card"
                          onClick={() => {
                            if (message.attachment_url) {
                              const link = document.createElement('a');
                              link.href = message.attachment_url;
                              link.download = message.attachment_info?.file_name || 'download';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
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
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  message.content
                )}
              </div>
              <div className="message-time">{formatTime(message.created_at)}</div>
            </div>
          </div>
        </div>
      );
    });
  }, [isOwnMessage, sortedMessages, navigate, setLightboxUrl, formatTime]);

  if (!conversation) {
    return null;
  }

  return (
    <WebSocketErrorBoundary
      resetOnPropsChange={true}
      resetKeys={[conversation?.conversation_id]}
      onError={(error, errorInfo) => {
        console.error('WebSocket Error in ChatInterface:', error, errorInfo);
        // Could send to error tracking service here
      }}
    >
      <div className="chat-container">
      <div className="chat-header">
        {onBack && (
          <button onClick={onBack} className="back-button">
            ←
          </button>
        )}
        <div className="chat-header-avatar">
          {conversation.other_participant?.name?.charAt(0) || '?'}
        </div>
        <div className="chat-header-info">
          <h3 className="chat-header-name">
            {conversation.other_participant?.name || 'Unknown User'}
          </h3>
          {/* Presence indicator removed per request */}
        </div>
      </div>

      <div className="chat-messages">
        {nextCursor && (
          <div className="load-more-container">
            <button 
              onClick={loadMoreMessages} 
              className="load-more-button"
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {sortedMessages.map((message, idx) => (
          <MessageComponent key={message.id} message={message} idx={idx} />
        ))}

        {typingUsersArray.length > 0 && (
          <div className="typing-indicator">
            <span>
              {typingUsersArray.length === 1 ? 'Someone is typing' : 'Multiple people are typing'}
            </span>
            <div className="typing-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {lightboxUrl && (
        <div 
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, cursor: 'zoom-out'
          }}
        >
          <img
            src={lightboxUrl}
            alt="Preview"
            style={{
              maxWidth: '96vw', maxHeight: '96vh', borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)'
            }}
          />
        </div>
      )}

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <input
            type="file"
            id="chat-file-input"
            style={{ display: 'none' }}
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.mp3,.mp4,.wav,.ogg,.avi,.mov"
            onChange={async () => {
              const inputEl = fileInputRef.current;
              const file = inputEl?.files?.[0] || null;
              if (!file || !conversation) return;
              try {
                const uploaded = await uploadAttachment(file);
                
                // Determine message type and content based on file category
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
                  created_at: saved.created_at,
                  is_read: saved.is_read,
                  message_type: (saved as any).message_type,
                  attachment_url: (() => {
                    const fromSaved = (saved as any).attachments && (saved as any).attachments[0]?.file_url;
                    const url = fromSaved || (uploaded as any).file_url || null;
                    if (!url) return null;
                    
                    // Validate URL is safe and properly formatted
                    try {
                      const urlObj = new URL(url);
                      // Only allow http/https protocols
                      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                        return url;
                      }
                    } catch {
                      // If URL parsing fails, check if it's a relative path
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
                setTimeout(scrollToBottom, 100);
              } catch (err) {
                console.error('Attachment send failed:', err);
              } finally {
                if (inputEl) inputEl.value = '';
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="send-button"
            title="Attach file"
            style={{ backgroundColor: '#e0e0e0', color: '#333' }}
          >
            📎
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            rows={1}
            style={{
              height: 'auto',
              minHeight: '24px',
              maxHeight: '120px',
            }}
          />
          <button 
            onClick={handleSend} 
            className="send-button"
            disabled={!inputValue.trim()}
          >
            →
          </button>
        </div>
      </div>
    </div>
    </WebSocketErrorBoundary>
  );
};

export default ChatInterface;


