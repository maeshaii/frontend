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
import { ConversationWebSocket, WsEvent } from '../../services/websocketHelper';
import { TypingIndicator } from '../../services/typingIndicator';
import { getConversationWsUrl } from '../../services/api';
import { getFileIcon, getFileTypeDisplayName, formatFileSize, isImageFile, isVideoFile, isAudioFile, canPreview, FileCategory } from '../../utils/fileUtils';
import { deduplicateMessages, addMessageWithDeduplication, replaceTempMessage, removeTempMessage, isDuplicateMessage, sortMessagesBySequence, detectSequenceGaps, UiMessage } from '../../utils/messageUtils';
import { sanitizeUserInput, validateMessageType } from '../../utils/securityUtils';
import { WebSocketErrorBoundary } from '../../components/ErrorBoundary';
import { useLogger } from '../../utils/logger';
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
  const [isRecording, setIsRecording] = useState(false);
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
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation, scrollToBottom]);

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
      const sanitizedText = sanitizeUserInput(inputText);
      console.log('Sanitized text:', sanitizedText); // Debug log
      
      if (!sanitizedText) {
        logger.warn('Message content is empty after sanitization');
        return;
      }

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
            <h2 className="mobile-title">
              {conversation.other_participant?.name || 'Unknown User'}
            </h2>
          </div>
        )}

        {/* Desktop Header */}
        {!onBack && (
          <div className="chat-header">
            <div className="chat-header-avatar">
              {conversation.other_participant?.name?.charAt(0) || '?'}
            </div>
            <div className="chat-header-info">
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
                
                return (
                  <div key={groupIndex} className={`message-group ${isOwn ? 'sent' : 'received'}`}>
                    {group.messages.map((message, messageIndex) => (
                      <div key={message.id} className={`message-item ${isOwn ? 'sent' : 'received'}`}>
                        <div className="message-bubble">
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
                          <div className="message-text">{message.content}</div>
                        )}
                        </div>
                        
                        {messageIndex === group.messages.length - 1 && (
                          <div className="message-time">
                            {formatTime(message.created_at)}
                            {isOwn && (
                              <div className="message-status">
                                <span className="status-icon delivered">✓✓</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
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
            <div className="input-wrapper">
              <div className="input-actions">
                <button 
                  className="input-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  📎
                </button>
                <button 
                  className="input-action-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Emoji"
                >
                  😊
                </button>
                <button 
                  className="input-action-btn"
                  onMouseDown={() => setIsRecording(true)}
                  onMouseUp={() => setIsRecording(false)}
                  onMouseLeave={() => setIsRecording(false)}
                  title="Voice message"
                >
                  {isRecording ? '🔴' : '🎤'}
                </button>
              </div>
              
              <textarea
                ref={inputRef}
                className="message-input"
                placeholder="Type a message..."
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
