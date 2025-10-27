import { getConversationWsUrl } from './api';
import { connectionManager } from './connectionManager';

export interface TypingIndicatorOptions {
  conversationId: number;
  userId: number;
  userName: string;
  onTypingStart?: (userId: number, userName: string) => void;
  onTypingStop?: (userId: number) => void;
  onError?: (error: Event) => void;
}

export class TypingIndicator {
  private ws: WebSocket | null = null;
  private conversationId: number;
  private userId: number;
  private userName: string;
  private onTypingStart?: (userId: number, userName: string) => void;
  private onTypingStop?: (userId: number) => void;
  private onError?: (error: Event) => void;
  private isConnecting = false;
  private isDestroyed = false;
  private connectionId: string;

  constructor(options: TypingIndicatorOptions) {
    this.conversationId = options.conversationId;
    this.userId = options.userId;
    this.userName = options.userName;
    this.onTypingStart = options.onTypingStart;
    this.onTypingStop = options.onTypingStop;
    this.onError = options.onError;
    this.connectionId = `typing_${this.conversationId}_${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  connect(): Promise<void> {
    // Typing indicator no longer creates its own WebSocket
    // It reuses the main conversation WebSocket passed from ModernChatInterface
    // This prevents connection manager conflicts
    return Promise.resolve();
  }

  sendTyping(isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'typing',
          is_typing: isTyping,
          user_id: this.userId,
          user_name: this.userName,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Error sending typing indicator:', error);
      }
    }
  }
  
  // Set the WebSocket from the parent component (ModernChatInterface)
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.ws = null;
    this.isConnecting = false;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export type TypingIndicatorData = {
  user_id: number;
  conversation_id: number;
  is_typing: boolean;
  timestamp: string;
};
