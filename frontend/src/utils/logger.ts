/**
 * Simple logger utility for frontend
 * Provides consistent logging interface and allows for easy switching to advanced logging libraries
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  // eslint-disable-next-line no-undef
  private isTest = import.meta.env.MODE === 'test' || process.env.NODE_ENV === 'test';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment && !this.isTest) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (!this.isTest) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (!this.isTest) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (!this.isTest) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  /**
   * Log an error with optional error object
   */
  errorWithException(message: string, error: unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    };

    this.error(message, errorContext);
  }
}

export const logger = new Logger();
