/**
 * Frontend monitoring and error tracking utilities.
 * 
 * This module provides client-side monitoring, error tracking, and performance
 * metrics for the messaging system.
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

class FrontendMonitor {
  private errorQueue: Array<{ error: Error; context: ErrorContext; timestamp: number }> = [];
  private performanceMetrics: Array<{ metric: PerformanceMetric; timestamp: number }> = [];
  private maxQueueSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startFlushTimer();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Track an error with context
   */
  trackError(error: Error, context: ErrorContext = {}): void {
    try {
      // Add to error queue
      this.errorQueue.push({
        error,
        context: {
          ...context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      // Keep queue size manageable
      if (this.errorQueue.length > this.maxQueueSize) {
        this.errorQueue.shift();
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Frontend Error:', error, context);
      }

      // Send to monitoring service in production
      if (process.env.NODE_ENV === 'production') {
        this.sendErrorToService(error, context);
      }

    } catch (e) {
      console.error('Failed to track error:', e);
    }
  }

  /**
   * Track a performance metric
   */
  trackPerformance(metric: PerformanceMetric): void {
    try {
      // Add to metrics queue
      this.performanceMetrics.push({
        metric: {
          ...metric,
          tags: {
            ...metric.tags,
            userAgent: navigator.userAgent,
            url: window.location.href,
          },
        },
        timestamp: Date.now(),
      });

      // Keep queue size manageable
      if (this.performanceMetrics.length > this.maxQueueSize) {
        this.performanceMetrics.shift();
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Performance Metric:', metric);
      }

    } catch (e) {
      console.error('Failed to track performance metric:', e);
    }
  }

  /**
   * Track WebSocket events
   */
  trackWebSocketEvent(eventType: string, context: ErrorContext = {}): void {
    this.trackPerformance({
      name: 'websocket_event',
      value: 1,
      unit: 'count',
      tags: {
        event_type: eventType,
        component: 'websocket',
        ...Object.fromEntries(
          Object.entries(context).map(([key, value]) => [key, String(value)])
        ),
      },
    });
  }

  /**
   * Track message operations
   */
  trackMessageOperation(operation: string, duration: number, context: ErrorContext = {}): void {
    this.trackPerformance({
      name: 'message_operation',
      value: duration,
      unit: 'milliseconds',
      tags: {
        operation,
        component: 'messaging',
        ...Object.fromEntries(
          Object.entries(context).map(([key, value]) => [key, String(value)])
        ),
      },
    });
  }

  /**
   * Track user interactions
   */
  trackUserInteraction(action: string, context: ErrorContext = {}): void {
    this.trackPerformance({
      name: 'user_interaction',
      value: 1,
      unit: 'count',
      tags: {
        action,
        component: 'ui',
        ...Object.fromEntries(
          Object.entries(context).map(([key, value]) => [key, String(value)])
        ),
      },
    });
  }

  /**
   * Start performance measurement
   */
  startMeasurement(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.trackPerformance({
        name: 'measurement',
        value: duration,
        unit: 'milliseconds',
        tags: {
          measurement_name: name,
        },
      });
    };
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        new Error(event.reason?.message || 'Unhandled Promise Rejection'),
        {
          component: 'global',
          action: 'unhandledrejection',
          reason: event.reason?.toString(),
        }
      );
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.trackError(
        new Error(event.message),
        {
          component: 'global',
          action: 'global_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    });
  }

  /**
   * Send error to monitoring service
   */
  private async sendErrorToService(error: Error, context: ErrorContext): Promise<void> {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      };

      // In a real application, you would send this to your monitoring service
      // For now, we'll just log it
      console.error('Error sent to monitoring service:', errorData);

      // Example: Send to your backend monitoring endpoint
      // await fetch('/api/monitoring/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // });

    } catch (e) {
      console.error('Failed to send error to monitoring service:', e);
    }
  }

  /**
   * Flush metrics to monitoring service
   */
  private async flushMetrics(): Promise<void> {
    try {
      if (this.performanceMetrics.length === 0) {
        return;
      }

      const metricsData = {
        metrics: this.performanceMetrics.map(item => ({
          ...item.metric,
          timestamp: item.timestamp,
        })),
        timestamp: Date.now(),
      };

      // In a real application, you would send this to your monitoring service
      console.log('Metrics flushed to monitoring service:', metricsData);

      // Example: Send to your backend monitoring endpoint
      // await fetch('/api/monitoring/metrics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(metricsData),
      // });

      // Clear metrics after successful flush
      this.performanceMetrics = [];

    } catch (e) {
      console.error('Failed to flush metrics:', e);
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary(): {
    errorCount: number;
    performanceMetricsCount: number;
    lastFlush: number;
  } {
    return {
      errorCount: this.errorQueue.length,
      performanceMetricsCount: this.performanceMetrics.length,
      lastFlush: Date.now(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush remaining metrics
    this.flushMetrics();
  }
}

// Global monitoring instance
export const frontendMonitor = new FrontendMonitor();

// Utility functions
export function trackError(error: Error, context: ErrorContext = {}): void {
  frontendMonitor.trackError(error, context);
}

export function trackPerformance(metric: PerformanceMetric): void {
  frontendMonitor.trackPerformance(metric);
}

export function trackWebSocketEvent(eventType: string, context: ErrorContext = {}): void {
  frontendMonitor.trackWebSocketEvent(eventType, context);
}

export function trackMessageOperation(operation: string, duration: number, context: ErrorContext = {}): void {
  frontendMonitor.trackMessageOperation(operation, duration, context);
}

export function trackUserInteraction(action: string, context: ErrorContext = {}): void {
  frontendMonitor.trackUserInteraction(action, context);
}

export function startMeasurement(name: string): () => void {
  return frontendMonitor.startMeasurement(name);
}

// React hook for error tracking
export function useErrorTracking() {
  const trackError = (error: Error, context: ErrorContext = {}) => {
    frontendMonitor.trackError(error, {
      ...context,
      component: 'react_component',
    });
  };

  return { trackError };
}

// React hook for performance tracking
export function usePerformanceTracking() {
  const trackPerformance = (metric: PerformanceMetric) => {
    frontendMonitor.trackPerformance({
      ...metric,
      tags: {
        ...metric.tags,
        component: 'react_component',
      },
    });
  };

  const startMeasurement = (name: string) => {
    return frontendMonitor.startMeasurement(name);
  };

  return { trackPerformance, startMeasurement };
}
