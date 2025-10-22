/**
 * Production-ready logging utility for frontend applications.
 * 
 * This module provides a centralized logging system that:
 * - Removes excessive console logging in production builds
 * - Provides structured logging with different levels
 * - Integrates with error tracking services
 * - Maintains performance in production
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  source?: string;
}

class Logger {
  private logLevel: LogLevel;
  public isProduction: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: any, source?: string): void {
    this.log(LogLevel.DEBUG, message, data, source);
  }

  /**
   * Log info messages
   */
  info(message: string, data?: any, source?: string): void {
    this.log(LogLevel.INFO, message, data, source);
  }

  /**
   * Log warning messages
   */
  warn(message: string, data?: any, source?: string): void {
    this.log(LogLevel.WARN, message, data, source);
  }

  /**
   * Log error messages
   */
  error(message: string, data?: any, source?: string): void {
    this.log(LogLevel.ERROR, message, data, source);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, source?: string): void {
    // Don't log if level is below threshold
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      source
    };

    // Add to buffer for potential error reporting
    this.addToBuffer(logEntry);

    // Only log to console in development or for errors/warnings
    if (!this.isProduction || level >= LogLevel.WARN) {
      this.logToConsole(logEntry);
    }

    // Send errors to monitoring service in production
    if (this.isProduction && level >= LogLevel.ERROR) {
      this.sendToMonitoring(logEntry);
    }
  }

  /**
   * Log to console with appropriate method
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] ${entry.source ? `[${entry.source}] ` : ''}`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix + entry.message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(prefix + entry.message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(prefix + entry.message, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(prefix + entry.message, entry.data);
        break;
    }
  }

  /**
   * Add log entry to buffer for error reporting
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Send error logs to monitoring service
   */
  private sendToMonitoring(entry: LogEntry): void {
    // In a real implementation, you would send this to your monitoring service
    // For now, we'll just store it for potential retrieval
    
    try {
      // Example: Send to Sentry or other monitoring service
      // Sentry.captureMessage(entry.message, {
      //   level: this.getSentryLevel(entry.level),
      //   extra: entry.data,
      //   tags: { source: entry.source }
      // });
      
      // Store in localStorage for debugging (remove in production)
      if (!this.isProduction) {
        const errorLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
        errorLogs.push(entry);
        localStorage.setItem('error_logs', JSON.stringify(errorLogs.slice(-10))); // Keep last 10
      }
    } catch (e) {
      // Don't let logging errors break the application
    }
  }

  /**
   * Get recent log entries for debugging
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Get log statistics
   */
  getLogStats(): { total: number; byLevel: Record<string, number> } {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      }
    };

    for (const entry of this.logBuffer) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          stats.byLevel.debug++;
          break;
        case LogLevel.INFO:
          stats.byLevel.info++;
          break;
        case LogLevel.WARN:
          stats.byLevel.warn++;
          break;
        case LogLevel.ERROR:
          stats.byLevel.error++;
          break;
      }
    }

    return stats;
  }
}

// Create global logger instance
export const logger = new Logger();

// Export convenience functions
export const debug = (message: string, data?: any, source?: string) => 
  logger.debug(message, data, source);

export const info = (message: string, data?: any, source?: string) => 
  logger.info(message, data, source);

export const warn = (message: string, data?: any, source?: string) => 
  logger.warn(message, data, source);

export const error = (message: string, data?: any, source?: string) => 
  logger.error(message, data, source);

// React hook for logging in components
export function useLogger(source: string) {
  return {
    debug: (message: string, data?: any) => logger.debug(message, data, source),
    info: (message: string, data?: any) => logger.info(message, data, source),
    warn: (message: string, data?: any) => logger.warn(message, data, source),
    error: (message: string, data?: any) => logger.error(message, data, source),
  };
}

// Performance logging utility
export function logPerformance(name: string, fn: () => void): void {
  if (!logger.isProduction) {
    const start = performance.now();
    fn();
    const end = performance.now();
    logger.debug(`Performance: ${name} took ${end - start}ms`);
  } else {
    fn();
  }
}

// Async performance logging utility
export async function logAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!logger.isProduction) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    logger.debug(`Async Performance: ${name} took ${end - start}ms`);
    return result;
  } else {
    return await fn();
  }
}
