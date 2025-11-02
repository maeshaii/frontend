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
  private maxTotalConnections = 3;
  private connectionTimeout = 30000; // 30 seconds

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
      if (timeSinceLastConnection < this.connectionTimeout && existing.isConnecting) {
        console.warn(`Connection ${id} is already connecting or recently connected`);
        return false;
      }
    }

    // Check total connection limit
    if (this.connections.size >= this.maxTotalConnections) {
      console.warn('Maximum total connections reached');
      return false;
    }

    // Check per-type connection limit
    const connectionsOfType = Array.from(this.connections.values()).filter(
      conn => conn.type === type
    );
    if (connectionsOfType.length >= this.maxConnectionsPerType) {
      console.warn(`Maximum ${type} connections reached`);
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

    console.log(`Registered ${type} connection: ${id}`);
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















