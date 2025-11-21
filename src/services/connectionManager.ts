/**
 * Global WebSocket Connection Manager
 * Prevents multiple simultaneous connections and manages connection state
 */

interface ConnectionInfo {
  id: string;
  type: 'conversation' | 'notification' | 'typing';
  conversationId?: number;
  userId?: number;
  lastConnected: number;
  isConnecting: boolean;
}

class ConnectionManager {
  private connections = new Map<string, ConnectionInfo>();
  private maxConnectionsPerType = 1;
  private maxTotalConnections = 5; // Increased for notifications
  private connectionTimeout = 5000; // 5 seconds - reduced to prevent rapid reconnects
  private connectionCooldown = 2000; // 2 second cooldown between connection attempts

  /**
   * Register a new connection attempt
   */
  registerConnection(
    id: string,
    type: 'conversation' | 'notification' | 'typing',
    conversationId?: number,
    userId?: number
  ): boolean {
    // Check if connection already exists and is recent
    const existing = this.connections.get(id);
    if (existing) {
      const timeSinceLastConnection = Date.now() - existing.lastConnected;
      
      // If still connecting or recently connected, deny
      if (existing.isConnecting) {
        console.warn(`🚫 [ConnectionManager] Connection ${id} is already connecting`);
        return false;
      }
      
      // Enforce cooldown period to prevent rapid reconnects
      if (timeSinceLastConnection < this.connectionCooldown) {
        console.warn(`🚫 [ConnectionManager] Connection ${id} is in cooldown (${timeSinceLastConnection}ms < ${this.connectionCooldown}ms)`);
        return false;
      }
    }

    // Check total connection limit
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isConnecting);
    if (activeConnections.length >= this.maxTotalConnections) {
      console.warn('🚫 [ConnectionManager] Maximum total connections reached');
      return false;
    }

    // Check per-type connection limit (allow multiple of different types)
    const connectionsOfType = Array.from(this.connections.values()).filter(
      conn => conn.type === type && conn.isConnecting
    );
    if (connectionsOfType.length >= this.maxConnectionsPerType) {
      console.warn(`🚫 [ConnectionManager] Maximum ${type} connections reached`);
      return false;
    }

    // Register the connection
    this.connections.set(id, {
      id,
      type,
      conversationId,
      userId,
      lastConnected: Date.now(),
      isConnecting: true,
    });

    console.log(`✅ [ConnectionManager] Registered ${type} connection: ${id}`);
    return true;
  }

  /**
   * Mark connection as successfully established
   */
  markConnected(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.isConnecting = false;
      connection.lastConnected = Date.now();
      console.log(`Marked connection as connected: ${id}`);
    }
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(id: string): void {
    if (this.connections.has(id)) {
      this.connections.delete(id);
      console.log(`Unregistered connection: ${id}`);
    }
  }

  /**
   * Check if a connection is allowed
   */
  canConnect(
    id: string,
    type: 'conversation' | 'notification' | 'typing',
    conversationId?: number,
    userId?: number
  ): boolean {
    return this.registerConnection(id, type, conversationId, userId);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(id: string): ConnectionInfo | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all active connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Clean up old connections
   */
  cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      const timeSinceLastConnection = now - connection.lastConnected;
      if (timeSinceLastConnection > this.connectionTimeout * 2) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.unregisterConnection(id));
    
    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} old connections`);
    }
  }

  /**
   * Force disconnect all connections
   */
  disconnectAll(): void {
    this.connections.clear();
    console.log('Disconnected all connections');
  }
}

// Global instance
export const connectionManager = new ConnectionManager();

// Cleanup old connections every 5 minutes
setInterval(() => {
  connectionManager.cleanup();
}, 5 * 60 * 1000);

export default connectionManager;

























