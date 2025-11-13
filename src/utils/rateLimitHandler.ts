/**
 * Frontend rate limiting handler for WebSocket operations.
 * 
 * This module provides client-side rate limiting awareness and handling
 * for WebSocket operations to provide better user experience.
 */

export interface RateLimitInfo {
  allowed: boolean;
  reason?: string;
  retry_after?: number;
  limit?: number;
  current?: number;
  remaining?: number;
}

export interface RateLimitConfig {
  messageRate: number; // messages per minute
  connectionRate: number; // connections per minute
  typingRate: number; // typing events per minute
  retryDelay: number; // base retry delay in ms
  maxRetryDelay: number; // maximum retry delay in ms
}

export class RateLimitHandler {
  private config: RateLimitConfig;
  private messageQueue: Array<{ message: any; timestamp: number }> = [];
  private typingQueue: Array<{ event: any; timestamp: number }> = [];
  private lastMessageTime: number = 0;
  private lastTypingTime: number = 0;
  private retryCount: number = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      messageRate: 30, // 30 messages per minute
      connectionRate: 10, // 10 connections per minute
      typingRate: 60, // 60 typing events per minute
      retryDelay: 1000, // 1 second base delay
      maxRetryDelay: 30000, // 30 seconds max delay
      ...config,
    };
  }

  /**
   * Check if a message can be sent based on client-side rate limiting
   */
  canSendMessage(): { allowed: boolean; delay?: number } {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;
    const minInterval = (60 * 1000) / this.config.messageRate; // Convert to milliseconds

    if (timeSinceLastMessage < minInterval) {
      const delay = minInterval - timeSinceLastMessage;
      return { allowed: false, delay };
    }

    return { allowed: true };
  }

  /**
   * Check if a typing event can be sent
   */
  canSendTyping(): { allowed: boolean; delay?: number } {
    const now = Date.now();
    const timeSinceLastTyping = now - this.lastTypingTime;
    const minInterval = (60 * 1000) / this.config.typingRate; // Convert to milliseconds

    if (timeSinceLastTyping < minInterval) {
      const delay = minInterval - timeSinceLastTyping;
      return { allowed: false, delay };
    }

    return { allowed: true };
  }

  /**
   * Handle rate limit response from server
   */
  handleRateLimitResponse(rateLimitInfo: RateLimitInfo): {
    shouldRetry: boolean;
    retryDelay: number;
    showMessage: boolean;
    message: string;
  } {
    if (rateLimitInfo.allowed) {
      this.retryCount = 0;
      return {
        shouldRetry: false,
        retryDelay: 0,
        showMessage: false,
        message: '',
      };
    }

    this.retryCount++;
    const retryAfter = rateLimitInfo.retry_after || 60;
    const retryDelay = Math.min(
      this.config.retryDelay * Math.pow(2, this.retryCount - 1), // Exponential backoff
      this.config.maxRetryDelay
    );

    let message = 'Rate limit exceeded. Please slow down.';
    let showMessage = true;

    switch (rateLimitInfo.reason) {
      case 'user_rate_limit_exceeded':
        message = `You're sending messages too quickly. Please wait ${retryAfter} seconds.`;
        break;
      case 'connection_rate_limit_exceeded':
        message = 'Too many connection attempts. Please try again later.';
        showMessage = false; // Don't show UI message for connection limits
        break;
      case 'typing_rate_limit_exceeded':
        message = 'Typing indicator rate limit exceeded.';
        showMessage = false; // Don't show UI message for typing limits
        break;
      case 'conversation_rate_limit_exceeded':
        message = 'This conversation is receiving too many messages. Please wait.';
        break;
      default:
        message = `Rate limit exceeded. Retry in ${retryAfter} seconds.`;
    }

    return {
      shouldRetry: true,
      retryDelay: retryDelay * 1000, // Convert to milliseconds
      showMessage,
      message,
    };
  }

  /**
   * Record that a message was sent
   */
  recordMessageSent(): void {
    this.lastMessageTime = Date.now();
    this.retryCount = 0;
  }

  /**
   * Record that a typing event was sent
   */
  recordTypingSent(): void {
    this.lastTypingTime = Date.now();
  }

  /**
   * Queue a message for later sending
   */
  queueMessage(message: any): void {
    this.messageQueue.push({
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Queue a typing event for later sending
   */
  queueTypingEvent(event: any): void {
    this.typingQueue.push({
      event,
      timestamp: Date.now(),
    });
  }

  /**
   * Process queued messages
   */
  processMessageQueue(sendFunction: (message: any) => void): void {
    const now = Date.now();
    const processedMessages: number[] = [];

    this.messageQueue.forEach((item, index) => {
      const timeSinceQueued = now - item.timestamp;
      const canSend = this.canSendMessage();

      if (canSend.allowed || timeSinceQueued > 30000) { // Process after 30 seconds regardless
        sendFunction(item.message);
        processedMessages.push(index);
        this.recordMessageSent();
      }
    });

    // Remove processed messages (in reverse order to maintain indices)
    processedMessages.reverse().forEach(index => {
      this.messageQueue.splice(index, 1);
    });
  }

  /**
   * Process queued typing events
   */
  processTypingQueue(sendFunction: (event: any) => void): void {
    const now = Date.now();
    const processedEvents: number[] = [];

    this.typingQueue.forEach((item, index) => {
      const timeSinceQueued = now - item.timestamp;
      const canSend = this.canSendTyping();

      if (canSend.allowed || timeSinceQueued > 10000) { // Process after 10 seconds regardless
        sendFunction(item.event);
        processedEvents.push(index);
        this.recordTypingSent();
      }
    });

    // Remove processed events (in reverse order to maintain indices)
    processedEvents.reverse().forEach(index => {
      this.typingQueue.splice(index, 1);
    });
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    messageQueueLength: number;
    typingQueueLength: number;
    retryCount: number;
    lastMessageTime: number;
    lastTypingTime: number;
  } {
    return {
      messageQueueLength: this.messageQueue.length,
      typingQueueLength: this.typingQueue.length,
      retryCount: this.retryCount,
      lastMessageTime: this.lastMessageTime,
      lastTypingTime: this.lastTypingTime,
    };
  }

  /**
   * Reset rate limiting state
   */
  reset(): void {
    this.messageQueue = [];
    this.typingQueue = [];
    this.retryCount = 0;
    this.lastMessageTime = 0;
    this.lastTypingTime = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Global rate limit handler instance
export const rateLimitHandler = new RateLimitHandler();

// Utility functions
export function createRateLimitAwareWebSocket(
  ws: WebSocket,
  onRateLimit?: (info: RateLimitInfo) => void
): WebSocket {
  const originalSend = ws.send.bind(ws);

  ws.send = function(data: string | ArrayBuffer | Blob | ArrayBufferView) {
    try {
      const message = JSON.parse(data as string);
      
      // Check rate limits based on message type
      if (message.type === 'message') {
        const canSend = rateLimitHandler.canSendMessage();
        if (!canSend.allowed) {
          rateLimitHandler.queueMessage(message);
          return;
        }
        rateLimitHandler.recordMessageSent();
      } else if (message.type === 'typing') {
        const canSend = rateLimitHandler.canSendTyping();
        if (!canSend.allowed) {
          rateLimitHandler.queueTypingEvent(message);
          return;
        }
        rateLimitHandler.recordTypingSent();
      }
      
      originalSend(data);
    } catch (error) {
      // If not JSON, send as-is
      originalSend(data);
    }
  };

  // Handle rate limit responses
  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'rate_limit_exceeded' || data.type === 'connection_denied') {
        const rateLimitInfo: RateLimitInfo = {
          allowed: false,
          reason: data.reason,
          retry_after: data.retry_after,
        };
        
        const response = rateLimitHandler.handleRateLimitResponse(rateLimitInfo);
        
        if (onRateLimit) {
          onRateLimit(rateLimitInfo);
        }
        
        if (response.shouldRetry && response.retryDelay > 0) {
          setTimeout(() => {
            // Retry logic would go here
            console.log('Retrying after rate limit...');
          }, response.retryDelay);
        }
      }
    } catch (error) {
      // Ignore non-JSON messages
    }
  });

  return ws;
}
