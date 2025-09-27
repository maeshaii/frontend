export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type WsEvent = {
  type: 'message' | 'typing' | 'stop_typing' | 'user_online' | 'user_offline' | 'message_read' | 'read_receipt';
  conversation_id?: number;
  user_id?: number;
  message?: any;
  timestamp?: string;
  // Message-specific properties
  message_id?: number;
  sender_id?: number;
  sender_name?: string;
  content?: string;
  created_at?: string;
  is_typing?: boolean;
};

export class ConversationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private statusCallbacks: ((status: WsStatus) => void)[] = [];
  private eventCallbacks: ((event: WsEvent) => void)[] = [];
  private messageCallbacks: ((event: WsEvent) => void)[] = [];

  constructor(url: string | number) {
    this.url = typeof url === 'string' ? url : url.toString();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.statusCallbacks.forEach(callback => callback('connected'));
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.eventCallbacks.forEach(callback => callback(data));
            this.messageCallbacks.forEach(callback => callback(data));
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.statusCallbacks.forEach(callback => callback('disconnected'));
          
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.connect().catch(console.error);
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.statusCallbacks.forEach(callback => callback('error'));
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  onStatus(callback: (status: WsStatus) => void) {
    this.statusCallbacks.push(callback);
  }

  onEvent(callback: (event: WsEvent) => void) {
    this.eventCallbacks.push(callback);
  }

  onMessage(callback: (event: WsEvent) => void) {
    this.messageCallbacks.push(callback);
  }

  removeStatusCallback(callback: (status: WsStatus) => void) {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  removeEventCallback(callback: (event: WsEvent) => void) {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  removeMessageCallback(callback: (event: WsEvent) => void) {
    const index = this.messageCallbacks.indexOf(callback);
    if (index > -1) {
      this.messageCallbacks.splice(index, 1);
    }
  }
}

export class TypingIndicator {
  private ws: ConversationWebSocket;
  private conversationId: number;

  constructor(ws: ConversationWebSocket, conversationId?: number) {
    this.ws = ws;
    this.conversationId = conversationId || 0;
  }

  sendTyping(isTyping: boolean) {
    this.ws.send({
      type: isTyping ? 'typing' : 'stop_typing',
      conversation_id: this.conversationId,
      timestamp: new Date().toISOString()
    });
  }
}

export type TypingIndicatorData = {
  user_id: number;
  conversation_id: number;
  is_typing: boolean;
  timestamp: string;
};
