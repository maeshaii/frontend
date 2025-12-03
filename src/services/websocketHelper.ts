import { FileCategory } from '../utils/fileUtils';

import { connectionManager } from './connectionManager';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type WsEvent = {
  type: 'message' | 'typing' | 'stop_typing' | 'user_online' | 'user_offline' | 'message_read' | 'read_receipt' | 'rate_limit_exceeded' | 'connection_denied' | 'reaction' | 'edit' | 'delete';
  conversation_id?: number;
  user_id?: number;
  message?: any;
  timestamp?: string;
  // Message-specific properties
  message_id?: number;
  sender_id?: number;
  sender_name?: string;
  user_name?: string;
  content?: string;
  created_at?: string;
  message_type?: string;
  attachment_url?: string;
  attachment_info?: {
    file_name?: string;
    file_type?: string;
    file_category?: FileCategory;
    file_size?: number;
  };
  attachments?: Array<{
    file_url?: string;
    file_name?: string;
    file_type?: string;
    file_category?: FileCategory;
    file_size?: number;
  }>;
  is_typing?: boolean;
  // Rate limiting properties
  reason?: string;
  retry_after?: number;
  // Reaction-specific properties
  emoji?: string;
  action?: 'add' | 'remove';
};

export class ConversationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private statusCallbacks: ((status: WsStatus) => void)[] = [];
  private eventCallbacks: ((event: WsEvent) => void)[] = [];
  private messageCallbacks: ((event: WsEvent) => void)[] = [];
  private isConnecting = false;
  private isDestroyed = false;
  private rateLimitRetryAfter = 0;
  private connectionId: string;

  constructor(url: string | number, token?: string) {
    this.url = typeof url === 'string' ? url : url.toString();
    this.token = token || null;
    this.connectionId = `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let hasResolved = false;
      
      // Check if we're already connecting or destroyed
      if (this.isConnecting || this.isDestroyed) {
        // Silently resolve if already connecting/destroyed
        resolve();
        return;
      }

      // Check connection manager
      if (!connectionManager.canConnect(this.connectionId, 'conversation')) {
        // Silently resolve if connection not allowed
        resolve();
        return;
      }

      // Check rate limiting
      if (this.rateLimitRetryAfter > 0) {
        const now = Date.now();
        if (now < this.rateLimitRetryAfter) {
          const waitTime = this.rateLimitRetryAfter - now;
          console.log(`Rate limited, waiting ${waitTime}ms before reconnecting`);
          setTimeout(() => {
            this.connect().then(resolve).catch(() => resolve());
          }, waitTime);
          return;
        }
        // Reset rate limit if time has passed
        this.rateLimitRetryAfter = 0;
      }

      this.isConnecting = true;
      this.statusCallbacks.forEach(callback => callback('connecting'));

      // Add timeout to prevent promise from hanging forever
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.warn('WebSocket connection timeout, resolving promise');
          resolve();
        }
      }, 10000); // 10 second timeout

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            console.log('WebSocket connected');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            this.rateLimitRetryAfter = 0;
            connectionManager.markConnected(this.connectionId);
            this.statusCallbacks.forEach(callback => callback('connected'));
            resolve();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check for rate limit messages
            if (data.type === 'rate_limit_exceeded' || data.type === 'connection_denied') {
              console.warn('Rate limit exceeded:', data);
              const retryAfter = data.retry_after || 60000;
              this.rateLimitRetryAfter = Date.now() + retryAfter;
              this.statusCallbacks.forEach(callback => callback('error'));
              return;
            }

            this.eventCallbacks.forEach(callback => {
              try {
                callback(data);
              } catch (callbackError) {
                console.error('Error in WebSocket message callback:', callbackError);
              }
            });
            this.messageCallbacks.forEach(callback => {
              try {
                callback(data);
              } catch (callbackError) {
                console.error('Error in WebSocket message callback:', callbackError);
              }
            });
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          connectionManager.unregisterConnection(this.connectionId);
          
          // Clear timeout if not already resolved
          clearTimeout(timeout);
          
          // Resolve promise if not already resolved (silently handle connection failures)
          if (!hasResolved) {
            hasResolved = true;
            console.warn('WebSocket closed before connection established, continuing without real-time updates');
            resolve();
          }
          
          // If this is a normal closure (intentional disconnect), update status
          if (event.code === 1000 || event.code === 1001) {
            this.statusCallbacks.forEach(callback => {
              try {
                callback('disconnected');
              } catch (callbackError) {
                console.error('Error in WebSocket status callback:', callbackError);
              }
            });
            // Don't reconnect for normal closures
            return;
          }
          
          // Abnormal closure - update status to error
          this.statusCallbacks.forEach(callback => {
            try {
              callback('error');
            } catch (callbackError) {
              console.error('Error in WebSocket status callback:', callbackError);
            }
          });
          
          // Only reconnect for unexpected closures if not destroyed
          if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isDestroyed) {
            this.reconnectAttempts++;
            // Use exponential backoff: 2s, 4s, 8s, 16s, 30s
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`🔄 [WebSocket] Will attempt to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
            setTimeout(() => {
              if (!this.isDestroyed) {
                console.log(`🔄 [WebSocket] Reconnecting now (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect().catch(error => {
                  console.warn('Reconnection failed:', error?.message || 'Unknown error');
                  this.statusCallbacks.forEach(callback => callback('error'));
                });
              }
            }, delay);
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ [WebSocket] Max reconnection attempts reached. Please refresh the page.');
          }
        };

        this.ws.onerror = (event) => {
          // Log detailed error information
          const ws = event.target as WebSocket;
          const errorDetails = {
            type: event.type,
            readyState: ws?.readyState,
            url: this.url,
            timestamp: new Date().toISOString()
          };
          console.warn('WebSocket connection error:', errorDetails);
          
          this.isConnecting = false;
          this.statusCallbacks.forEach(callback => {
            try {
              callback('error');
            } catch (callbackError) {
              console.error('Error in WebSocket error callback:', callbackError);
            }
          });
          
          // DON'T reject the promise here - let onclose handle reconnection
          // This prevents unhandled promise rejections and allows graceful degradation
        };

      } catch (error) {
        this.isConnecting = false;
        clearTimeout(timeout);
        if (!hasResolved) {
          hasResolved = true;
          console.warn('WebSocket connection error, continuing without real-time updates:', error);
          resolve();
        }
      }
    });
  }

  disconnect() {
    this.isDestroyed = true;
    this.isConnecting = false;
    if (this.ws) {
      // Only close if WebSocket is in a state that allows closing
      // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
      if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.close(1000, 'User disconnected');
        } catch (error) {
          // Ignore errors when closing - WebSocket might already be closing/closed
          console.debug('WebSocket close error (ignored):', error);
        }
      }
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.rateLimitRetryAfter = 0;
    connectionManager.unregisterConnection(this.connectionId);
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
