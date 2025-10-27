/**
 * Real-time notification WebSocket service.
 * Handles WebSocket connections for live notification updates.
 */

export interface NotificationUpdate {
  id: number;
  type: string;
  subject: string;
  content: string;
  date: string;
  is_read: boolean;
  timestamp: string;
}

export interface NotificationCountUpdate {
  count: number;
}

export type NotificationWsEvent = 
  | { type: 'notification_update'; notification: NotificationUpdate }
  | { type: 'notification_count_update'; count: number }
  | { type: 'connection_established'; user_id: number; timestamp: string }
  | { type: 'connection_denied'; reason: string; message: string }
  | { type: 'rate_limit_exceeded'; reason: string; retry_after?: number }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; message: string };

export type NotificationWsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private statusCallbacks: ((status: NotificationWsStatus) => void)[] = [];
  private eventCallbacks: ((event: NotificationWsEvent) => void)[] = [];
  private isConnecting = false;
  public isDestroyed = false;
  private heartbeatInterval: number | null = null;
  private rateLimitRetryAfter = 0;

  constructor(token?: string) {
    // Get WebSocket base URL - FIXED: Use backend port 8000 instead of frontend port 3000
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname; // Use hostname only, not host (which includes port)
    this.url = `${protocol}//${host}:8000/ws/notifications/`; // Explicitly use port 8000 for backend
    this.token = token || null;
    
    console.log('🔧 WebSocket constructor called');
    console.log('🔧 Protocol:', protocol);
    console.log('🔧 Hostname:', host);
    console.log('🔧 Full URL:', this.url);
    console.log('🔧 Token provided:', !!token);
  }

  onEvent(callback: (event: NotificationWsEvent) => void) {
    this.eventCallbacks.push(callback);
  }

  onStatus(callback: (status: NotificationWsStatus) => void) {
    this.statusCallbacks.push(callback);
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isDestroyed) return;
    
    // Check rate limiting
    if (this.rateLimitRetryAfter > 0) {
      const now = Date.now();
      if (now < this.rateLimitRetryAfter) {
        const waitTime = this.rateLimitRetryAfter - now;
        console.log(`Notification WebSocket rate limited, waiting ${waitTime}ms before reconnecting`);
        setTimeout(() => {
          this.connect();
        }, waitTime);
        return;
      }
      // Reset rate limit if time has passed
      this.rateLimitRetryAfter = 0;
    }
    
    this.isConnecting = true;
    this.statusCallbacks.forEach(callback => callback('connecting'));

    try {
      // Add token to URL if available
      let wsUrl = this.url;
      if (this.token) {
        wsUrl += `?token=${encodeURIComponent(this.token)}`;
      }
      
      console.log('🔌 Connecting to notification WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.rateLimitRetryAfter = 0;
        this.statusCallbacks.forEach(callback => callback('connected'));
        this.startHeartbeat();
        console.log('✅ Notification WebSocket connected successfully!');
      };

      this.ws.onmessage = (event) => {
        try {
          console.log('📨 Notification WebSocket received message:', event.data);
          const data: NotificationWsEvent = JSON.parse(event.data);
          
          // Check for rate limit messages
          if (data.type === 'rate_limit_exceeded' || data.type === 'connection_denied') {
            console.warn('Notification WebSocket rate limit exceeded:', data);
            const retryAfter = data.type === 'rate_limit_exceeded' ? (data.retry_after || 60000) : 60000;
            this.rateLimitRetryAfter = Date.now() + retryAfter;
            this.statusCallbacks.forEach(callback => callback('error'));
            return;
          }
          
          console.log('📋 Parsed notification data:', data);
          this.eventCallbacks.forEach(callback => callback(data));
        } catch (error) {
          console.warn('Failed to parse notification WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.statusCallbacks.forEach(callback => callback('disconnected'));
        
        if (!this.isDestroyed && !event.wasClean) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (event) => {
        // Log detailed error information without throwing
        const ws = event.target as WebSocket;
        const errorDetails = {
          type: event.type,
          readyState: ws?.readyState,
          url: wsUrl,
          timestamp: new Date().toISOString()
        };
        console.warn('Notification WebSocket connection error:', errorDetails);
        
        this.isConnecting = false;
        this.statusCallbacks.forEach(callback => callback('error'));
        
        // Don't throw error here - let it fail gracefully and rely on reconnect logic
      };

    } catch (error) {
      this.isConnecting = false;
      this.statusCallbacks.forEach(callback => callback('error'));
      throw error;
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      this.sendPing();
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached or WebSocket destroyed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff with max 30s
    
    console.log(`Scheduling notification WebSocket reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect().catch(console.error);
      }
    }, delay);
  }
}

// Global notification WebSocket instance
let globalNotificationWs: NotificationWebSocket | null = null;

export function getNotificationWebSocket(token?: string): NotificationWebSocket {
  if (!globalNotificationWs || globalNotificationWs.isDestroyed) {
    globalNotificationWs = new NotificationWebSocket(token);
  }
  return globalNotificationWs;
}

export function disconnectNotificationWebSocket() {
  if (globalNotificationWs) {
    globalNotificationWs.disconnect();
    globalNotificationWs = null;
  }
}
