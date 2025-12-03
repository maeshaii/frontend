export type RecentSearchEvent =
  | {
      type: 'recent_search_update';
      recent_searches?: any[];
      recent?: any[];
    }
  | { type: 'connection_established'; user_id: number; timestamp: string }
  | { type: 'connection_denied'; message?: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; message: string };

export type RecentSearchWsStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export class RecentSearchWebSocket {
  private ws: WebSocket | null = null;
  private statusCallbacks: Array<(status: RecentSearchWsStatus) => void> = [];
  private eventCallbacks: Array<(event: RecentSearchEvent) => void> = [];
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseDelay = 1000;
  private isDestroyed = false;
  private isConnecting = false;
  private readonly url: string;

  constructor(private token?: string | null) {
    // Use the same base URL as the main API instead of hardcoded localhost:8000
    // Get API base URL from environment variable (same as api.ts uses)
    const apiBase = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const baseWithoutApi = apiBase.replace(/\/api\/?$/, '');
    
    // Convert HTTP/HTTPS to WS/WSS
    const protocol = baseWithoutApi.startsWith('https://') ? 'wss:' : 'ws:';
    const urlWithoutProtocol = baseWithoutApi.replace(/^https?:\/\//, '');
    
    this.url = `${protocol}//${urlWithoutProtocol}/ws/recent-searches/`;
  }

  onStatus(callback: (status: RecentSearchWsStatus) => void) {
    this.statusCallbacks.push(callback);
  }

  onEvent(callback: (event: RecentSearchEvent) => void) {
    this.eventCallbacks.push(callback);
  }

  async connect() {
    if (this.isConnecting || this.isDestroyed) return;

    this.isConnecting = true;
    this.statusCallbacks.forEach((cb) => cb('connecting'));

    try {
      let wsUrl = this.url;
      if (this.token) {
        wsUrl += `?token=${encodeURIComponent(this.token)}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.statusCallbacks.forEach((cb) => cb('connected'));
      };

      this.ws.onmessage = (event) => {
        try {
          const data: RecentSearchEvent = JSON.parse(event.data);
          this.eventCallbacks.forEach((cb) => cb(data));
        } catch (error) {
          console.warn('RecentSearchWebSocket: failed to parse message', error);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.statusCallbacks.forEach((cb) =>
          cb(event.wasClean ? 'disconnected' : 'error')
        );
        if (!event.wasClean) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        this.statusCallbacks.forEach((cb) => cb('error'));
      };
    } catch (error) {
      this.isConnecting = false;
      this.statusCallbacks.forEach((cb) => cb('error'));
      throw error;
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this.isConnecting = false;
    if (this.ws) {
      // Only close if WebSocket is in a state that allows closing
      // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
      const readyState = this.ws.readyState;
      
      // For CONNECTING state, avoid calling close() to prevent browser error:
      // "WebSocket is closed before the connection is established"
      // Instead, just null it out and let the browser handle cleanup
      if (readyState === WebSocket.CONNECTING) {
        // Remove event handlers to prevent callbacks after disconnect
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        // Just null it out - the browser will clean up the connection
        this.ws = null;
        return;
      }
      
      // For OPEN state, we can safely close
      if (readyState === WebSocket.OPEN) {
        try {
          this.ws.close(1000, 'Client disconnect');
        } catch (error) {
          // Ignore errors when closing - WebSocket might already be closing/closed
          console.debug('WebSocket close error (ignored):', error);
        }
      }
      // For CLOSING or CLOSED states, we don't need to do anything
      
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    setTimeout(() => {
      if (!this.isDestroyed) {
        void this.connect();
      }
    }, delay);
  }
}

