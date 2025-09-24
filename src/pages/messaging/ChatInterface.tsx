import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  MessageItem, 
  ConversationSummary, 
  listMessages, 
  sendMessage, 
  markConversationRead,
  getUserInfo,
  uploadAttachment 
} from '../../services/api';
import { ConversationWebSocket, TypingIndicator, WsEvent } from '../../services/websocketHelper';
import './Messaging.css';

interface ChatInterfaceProps {
  conversation: ConversationSummary | null;
  onBack?: () => void;
}

type UiMessage = {
  id: string;
  content: string;
  sender_id: number;
  sender_name: string;
  created_at: string;
  is_read: boolean;
  tempId?: string;
  message_type?: string;
  attachment_url?: string | null;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversation, onBack }) => {
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
  const currentUser = getUserInfo();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          const url = ((m as any).attachments && (m as any).attachments[0]?.file_url) || null;
          if (!url) return null;
          return url.startsWith('http') ? url : `${window.location.origin}${url}`;
        })(),
      }));

      setMessages(prev => {
        const joined = cursor ? [...mapped, ...prev] : [...prev.filter(p => !mapped.some(m => m.id === p.id)), ...mapped];
        const byId: Record<string, UiMessage> = {};
        joined.forEach(m => { byId[m.id] = m; });
        const unique = Object.values(byId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        if (!cursor) setTimeout(scrollToBottom, 100);
        return unique;
      });
      
      setNextCursor(data.next_cursor ?? null);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [conversation, scrollToBottom]);

  const connectWebSocket = useCallback(() => {
    if (!conversation) return;

    const ws = new ConversationWebSocket(conversation.conversation_id);
    wsRef.current = ws;
    
    const typingIndicator = new TypingIndicator(ws);
    typingIndicatorRef.current = typingIndicator;

    ws.onStatus((status) => {
      setConnectionStatus(status);
      if (status === 'connected' && !hasMarkedRef.current) {
        markConversationRead(conversation.conversation_id).catch(() => {});
        hasMarkedRef.current = true;
        setHasMarkedAsRead(true);
      }
    });

    ws.onMessage((event: WsEvent) => {
      const myId = currentUser?.user_id ?? (currentUser as any)?.id;
      switch (event.type) {
        case 'message':
          // If this is our own echo via websocket, skip because REST already updated UI
          if (event.sender_id === myId) break;
          setMessages(prev => {
            const id = String(event.message_id);
            const map: Record<string, UiMessage> = {};
            prev.forEach(m => { map[m.id] = m; });
            map[id] = {
              id,
              content: event.content,
              sender_id: event.sender_id,
              sender_name: event.sender_name,
              created_at: event.created_at,
              is_read: false,
            };
            return Object.values(map);
          });
          setTimeout(scrollToBottom, 100);
          break;
        case 'typing':
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (event.is_typing) {
              newSet.add(event.user_id);
            } else {
              newSet.delete(event.user_id);
            }
            return newSet;
          });
          break;
        case 'read_receipt':
          // Handle read receipts if needed
          break;
      }
    });

    ws.connect();
  }, [conversation]);

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
      wsRef.current?.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversation, loadMessages, connectWebSocket]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !conversation) return;

    const tempId = Date.now().toString();
    const tempMessage: UiMessage = {
      id: tempId,
      content: text,
      sender_id: currentUser?.user_id || 0,
      sender_name: currentUser?.full_name || 'You',
      created_at: new Date().toISOString(),
      is_read: false,
      tempId,
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputValue('');
    
    // Stop typing indicator
    typingIndicatorRef.current?.sendTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      const saved = await sendMessage(conversation.conversation_id, { content: text, message_type: 'text' });
      // Replace temp with saved message
      setMessages(prev => prev.map(m => m.tempId === tempId ? {
        id: String(saved.message_id),
        content: saved.content,
        sender_id: saved.sender.user_id,
        sender_name: saved.sender.name,
        created_at: saved.created_at,
        is_read: saved.is_read,
        message_type: (saved as any).message_type,
        attachment_url: ((saved as any).attachments && (saved as any).attachments[0]?.file_url) || null,
      } : m));
    } catch (error) {
      console.error('Send failed:', error);
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
    }
    
    setTimeout(scrollToBottom, 100);
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

  const loadMoreMessages = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await loadMessages(nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOwnMessage = (message: UiMessage) => {
    const myId = currentUser?.user_id ?? (currentUser as any)?.id;
    return message.sender_id === myId;
  };

  if (!conversation) {
    return null;
  }

  return (
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

        {messages.map((message) => {
          const own = isOwnMessage(message);
          return (
            <div key={message.id} className={`message ${own ? 'sent' : 'received'}`}>
              <div className="message-bubble">
                {!own && (
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {message.sender_name || 'Them'}
                  </div>
                )}
                {own && (
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, opacity: 0.85 }}>
                    You
                  </div>
                )}
                <div>
                  {message.attachment_url && /\.(png|jpe?g|gif|webp)$/i.test(message.attachment_url)
                    ? (<img src={message.attachment_url} alt={message.content} style={{ maxWidth: '240px', borderRadius: 8 }} />)
                    : message.content}
                </div>
                <div className="message-time">{formatTime(message.created_at)}</div>
              </div>
            </div>
          );
        })}

        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <span>
              {Array.from(typingUsers).length === 1 ? 'Someone is typing' : 'Multiple people are typing'}
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

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <input
            type="file"
            id="chat-file-input"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={async () => {
              const inputEl = fileInputRef.current;
              const file = inputEl?.files?.[0] || null;
              if (!file || !conversation) return;
              try {
                const uploaded = await uploadAttachment(file);
                const isImage = (uploaded.file_type || '').startsWith('image/');
                const saved = await sendMessage(conversation.conversation_id, { content: uploaded.file_name, message_type: isImage ? 'image' : 'file', attachment_id: uploaded.attachment_id });
                setMessages(prev => [...prev, {
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
                    return url.startsWith('http') ? url : `${window.location.origin}${url}`;
                  })(),
                }]);
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
  );
};

export default ChatInterface;


