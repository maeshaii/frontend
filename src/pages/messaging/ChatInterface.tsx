import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  MessageItem, 
  ConversationSummary, 
  listMessages, 
  sendMessage, 
  markConversationRead,
  getUserInfo 
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
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversation, onBack }) => {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
      }));

      if (cursor) {
        // Loading more messages (prepend)
        setMessages(prev => [...mapped, ...prev]);
      } else {
        // Initial load
        setMessages(mapped);
        setTimeout(scrollToBottom, 100);
      }
      
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
      if (status === 'connected' && !hasMarkedAsRead) {
        markConversationRead(conversation.conversation_id).catch(() => {});
        setHasMarkedAsRead(true);
      }
    });

    ws.onMessage((event: WsEvent) => {
      switch (event.type) {
        case 'message':
          setMessages((prev) => {
            // Remove temp message if it exists
            const filtered = prev.filter(m => m.tempId !== event.temp_id);
            return [...filtered, {
              id: String(event.message_id),
              content: event.content,
              sender_id: event.sender_id,
              sender_name: event.sender_name,
              created_at: event.created_at,
              is_read: false,
            }];
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
  }, [conversation, hasMarkedAsRead, scrollToBottom]);

  useEffect(() => {
    if (conversation) {
      setMessages([]);
      setNextCursor(null);
      setHasMarkedAsRead(false);
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
      await sendMessage(conversation.conversation_id, { content: text, message_type: 'text' });
      wsRef.current?.send({ type: 'message', message: text, message_type: 'text', temp_id: tempId });
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
    return message.sender_id === currentUser?.user_id;
  };

  if (!conversation) {
    return (
      <div className="chat-container">
        <div className="empty-state">
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start messaging</p>
        </div>
      </div>
    );
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
          <div className="chat-header-status">
            <div className={`status-dot ${connectionStatus}`}></div>
            <span>
              {connectionStatus === 'connected' ? 'Online' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>
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

        {messages.map((message) => (
          <div key={message.id} className={`message ${isOwnMessage(message) ? 'sent' : 'received'}`}>
            <div className="message-bubble">
              <div>{message.content}</div>
              <div className="message-time">{formatTime(message.created_at)}</div>
            </div>
          </div>
        ))}

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


