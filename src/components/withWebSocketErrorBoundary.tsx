import React, { ComponentType } from 'react';
import { WebSocketErrorBoundary } from './ErrorBoundary';

interface WithWebSocketErrorBoundaryOptions {
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function withWebSocketErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithWebSocketErrorBoundaryOptions = {}
) {
  const WithWebSocketErrorBoundaryComponent = (props: P) => {
    return (
      <WebSocketErrorBoundary
        resetOnPropsChange={options.resetOnPropsChange}
        resetKeys={options.resetKeys}
        onError={options.onError}
      >
        <WrappedComponent {...props} />
      </WebSocketErrorBoundary>
    );
  };

  WithWebSocketErrorBoundaryComponent.displayName = `withWebSocketErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithWebSocketErrorBoundaryComponent;
}

// Hook for handling WebSocket errors in functional components
export function useWebSocketErrorHandler() {
  const handleError = (error: Error | Event | any, context?: string) => {
    try {
      let errorMessage = 'Unknown WebSocket error';
      let errorStack = '';
      
      // Handle different types of error objects
      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack || '';
      } else if (error && typeof error === 'object' && error.message) {
        errorMessage = error.message;
        errorStack = error.stack || '';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Event) {
        errorMessage = `WebSocket Event error: ${error.type}`;
        errorStack = `Event type: ${error.type}, target: ${error.target}`;
        // Add more details if available
        if (error.target && typeof error.target === 'object') {
          const target = error.target as any;
          if (target.readyState !== undefined) {
            errorStack += `, readyState: ${target.readyState}`;
          }
          if (target.url) {
            errorStack += `, url: ${target.url}`;
          }
        }
      } else {
        errorMessage = String(error);
      }
      
      console.error(`WebSocket Error${context ? ` in ${context}` : ''}:`, errorMessage);
      
      // In production, you would send this to an error tracking service
      if (process.env.NODE_ENV === 'production') {
        const errorData = {
          type: 'websocket_error',
          message: errorMessage,
          stack: errorStack,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        };
        
        // Example: Send to error tracking service
        // fetch('/api/errors/websocket', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(errorData),
        // }).catch(console.error);
        
        console.error('WebSocket error logged:', errorData);
      }
    } catch (e) {
      console.warn('Failed to handle WebSocket error:', e);
    }
  };

  return { handleError };
}

// Utility function to create error-safe WebSocket operations
export function createErrorSafeWebSocketOperation<T extends any[], R>(
  operation: (...args: T) => R,
  context: string = 'WebSocket'
): (...args: T) => R | null {
  return (...args: T): R | null => {
    try {
      return operation(...args);
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      
      // In production, log to error tracking service
      if (process.env.NODE_ENV === 'production') {
        const errorData = {
          type: 'websocket_operation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          context,
          args: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ),
          timestamp: new Date().toISOString(),
        };
        
        console.error('WebSocket operation error logged:', errorData);
      }
      
      return null;
    }
  };
}

// React hook for managing WebSocket connection state with error handling
export function useWebSocketConnection() {
  const [connectionState, setConnectionState] = React.useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = React.useState<Error | null>(null);
  const { handleError } = useWebSocketErrorHandler();

  const handleConnectionError = React.useCallback((error: Error | Event | any) => {
    setConnectionState('error');
    setLastError(error instanceof Error ? error : new Error(String(error)));
    handleError(error, 'WebSocket Connection');
  }, [handleError]);

  const handleConnectionSuccess = React.useCallback(() => {
    setConnectionState('connected');
    setLastError(null);
  }, []);

  const handleConnectionStart = React.useCallback(() => {
    setConnectionState('connecting');
    setLastError(null);
  }, []);

  const handleDisconnection = React.useCallback(() => {
    setConnectionState('disconnected');
    setLastError(null);
  }, []);

  const resetConnection = React.useCallback(() => {
    setConnectionState('disconnected');
    setLastError(null);
  }, []);

  return {
    connectionState,
    lastError,
    handleConnectionError,
    handleConnectionSuccess,
    handleConnectionStart,
    handleDisconnection,
    resetConnection,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    hasError: connectionState === 'error',
  };
}


