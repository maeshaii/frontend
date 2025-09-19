import { getConversationWsUrl } from './api';

export type WsEvent = 
  | { type: 'message'; message_id: number; content: string; sender_id: number; sender_name: string; message_type: string; created_at: string; temp_id?: string }
  | { type: 'typing'; user_id: number; user_name: string; is_typing: boolean; timestamp: string }
  | { type: 'read_receipt'; message_id: number; read_by: number; read_at: string }
  | { type: 'connection_established'; conversation_id: string; user_id: number; timestamp: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; message: string };

export type WsSendMessage = 
  | { type: 'message'; message: string; message_type?: string; temp_id?: string }
  | { type: 'typing'; is_typing: boolean }
  | { type: 'read_receipt'; message_id: number }
  | { type: 'ping' };

export class ConversationWebSocket {
  private ws: WebSocket | null = null;
  private conversationId: number;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval: number | null = null;
  private isConnecting = false;
  private isDestroyed = false;
  private messageQueue: WsSendMessage[] = [];
  private onMessageCallback: ((event: WsEvent) => void) | null = null;
  private onStatusCallback: ((status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) | null = null;

  constructor(conversationId: number) {
    this.conversationId = conversationId;
  }

  onMessage(callback: (event: WsEvent) => void) {
    this.onMessageCallback = callback;
  }

  onStatus(callback: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) {
    this.onStatusCallback = callback;
  }

  connect(): void {
    if (this.isConnecting || this.isDestroyed) return;
    
    this.isConnecting = true;
    this.onStatusCallback?.('connecting');

    try {
      const wsUrl = getConversationWsUrl(this.conversationId);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.onStatusCallback?.('connected');
        this.startHeartbeat();
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WsEvent = JSON.parse(event.data);
          this.onMessageCallback?.(data);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onStatusCallback?.('disconnected');
        
        if (!this.isDestroyed && !event.wasClean) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.onStatusCallback?.('error');
        console.warn('WebSocket error:', error);
      };

    } catch (error) {
      this.isConnecting = false;
      this.onStatusCallback?.('error');
      console.warn('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 25000); // Ping every 25 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  send(message: WsSendMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.messageQueue = [];
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.ws?.readyState === WebSocket.CLOSED) return 'disconnected';
    return 'error';
  }
}

// Typing indicator throttling
export class TypingIndicator {
  private lastSent = 0;
  private throttleMs = 2000; // Send max once every 2 seconds
  private ws: ConversationWebSocket;

  constructor(ws: ConversationWebSocket) {
    this.ws = ws;
  }

  sendTyping(isTyping: boolean) {
    const now = Date.now();
    if (now - this.lastSent < this.throttleMs) {
      return;
    }
    
    this.lastSent = now;
    this.ws.send({ type: 'typing', is_typing: isTyping });
  }
}


