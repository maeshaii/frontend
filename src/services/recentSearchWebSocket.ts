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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    this.url = `${protocol}//${host}:8000/ws/recent-searches/`;
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
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
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

