/**
 * WebSocket Cleanup Utility
 * Provides global cleanup mechanisms for WebSocket connections
 */

import { connectionManager } from './connectionManager';

class WebSocketCleanup {
  private static instance: WebSocketCleanup;
  private cleanupInterval: number | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): WebSocketCleanup {
    if (!WebSocketCleanup.instance) {
      WebSocketCleanup.instance = new WebSocketCleanup();
    }
    return WebSocketCleanup.instance;
  }

  /**
   * Initialize cleanup mechanisms
   */
  initialize(): void {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    
    // Clean up connections every 30 seconds
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, 30000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanupAll();
    });

    // Clean up on visibility change (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performCleanup();
      }
    });

    console.log('🔧 WebSocket cleanup initialized');
  }

  /**
   * Perform routine cleanup
   */
  private performCleanup(): void {
    try {
      connectionManager.cleanup();
      
      // Log current connection status
      const connections = connectionManager.getAllConnections();
      if (connections.length > 0) {
        console.log(`🔧 Active WebSocket connections: ${connections.length}`);
        connections.forEach(conn => {
          console.log(`  - ${conn.type}: ${conn.id} (${conn.isConnecting ? 'connecting' : 'connected'})`);
        });
      }
    } catch (error) {
      console.warn('Error during WebSocket cleanup:', error);
    }
  }

  /**
   * Force cleanup all connections
   */
  cleanupAll(): void {
    try {
      connectionManager.disconnectAll();
      
      // Clear any remaining intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      console.log('🔧 All WebSocket connections cleaned up');
    } catch (error) {
      console.warn('Error during full WebSocket cleanup:', error);
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const connections = connectionManager.getAllConnections();
    const byType: Record<string, number> = {};
    
    connections.forEach(conn => {
      byType[conn.type] = (byType[conn.type] || 0) + 1;
    });
    
    return {
      total: connections.length,
      byType
    };
  }

  /**
   * Destroy the cleanup instance
   */
  destroy(): void {
    this.cleanupAll();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const websocketCleanup = WebSocketCleanup.getInstance();

// Auto-initialize when module is imported
websocketCleanup.initialize();

export default websocketCleanup;






























































