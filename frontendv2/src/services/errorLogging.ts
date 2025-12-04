/**
 * Error Logging Service
 * Centralized error logging that can integrate with external services
 * (Sentry, LogRocket, etc.)
 */

interface ErrorLogData {
  type: string;
  statusCode?: number;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
  userId?: string;
}

interface LoggingConfig {
  enabled: boolean;
  environment: string;
  apiEndpoint?: string;
  maxRetries?: number;
}

class ErrorLoggingService {
  private config: LoggingConfig;
  private queue: ErrorLogData[] = [];
  private isProcessing = false;

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = {
      enabled: !import.meta.env.DEV, // Disable in development by default
      environment: import.meta.env.MODE || 'development',
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Log an error to the service
   */
  log(errorData: Omit<ErrorLogData, 'userAgent' | 'url'>): void {
    if (!this.config.enabled) {
      // In development, just console log
      console.warn('[ErrorLogging] Service disabled - would have logged:', errorData);
      return;
    }

    const enrichedData: ErrorLogData = {
      ...errorData,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    };

    this.queue.push(enrichedData);
    this.processQueue();
  }

  /**
   * Process the error queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const errorData = this.queue.shift();
      if (!errorData) continue;

      try {
        await this.sendToService(errorData);
      } catch (err) {
        console.error('[ErrorLogging] Failed to send error log:', err);
        // Could implement retry logic here
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send error data to logging service
   * This is where you'd integrate with Sentry, LogRocket, etc.
   */
  private async sendToService(errorData: ErrorLogData): Promise<void> {
    // Example: Send to custom backend endpoint
    if (this.config.apiEndpoint) {
      try {
        await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...errorData,
            environment: this.config.environment,
          }),
        });
      } catch (err) {
        console.error('[ErrorLogging] HTTP send failed:', err);
      }
    }

    // Example: Integrate with Sentry
    // if (window.Sentry) {
    //   window.Sentry.captureException(new Error(errorData.message), {
    //     level: 'error',
    //     extra: errorData.context,
    //     tags: {
    //       type: errorData.type,
    //       statusCode: errorData.statusCode?.toString(),
    //     },
    //   });
    // }

    // Example: Integrate with LogRocket
    // if (window.LogRocket) {
    //   window.LogRocket.captureException(new Error(errorData.message), {
    //     tags: {
    //       type: errorData.type,
    //     },
    //     extra: errorData.context,
    //   });
    // }

    // For now, log to console in production
    console.error('[ErrorLogging] Logged error:', {
      type: errorData.type,
      message: errorData.message,
      statusCode: errorData.statusCode,
      timestamp: errorData.timestamp,
    });
  }

  /**
   * Get user ID from storage or state
   */
  private getUserId(): string | undefined {
    // Try to get user ID from localStorage, state management, etc.
    try {
      const userStore = localStorage.getItem('user-store');
      if (userStore) {
        const parsed = JSON.parse(userStore);
        return parsed?.state?.user?.id;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  /**
   * Enable logging
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable logging
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Set API endpoint for custom logging backend
   */
  setEndpoint(endpoint: string): void {
    this.config.apiEndpoint = endpoint;
  }
}

// Create singleton instance
export const errorLoggingService = new ErrorLoggingService({
  enabled: !import.meta.env.DEV,
  apiEndpoint: import.meta.env.VITE_ERROR_LOGGING_ENDPOINT,
});

// Export type for use in other modules
export type { ErrorLogData };
