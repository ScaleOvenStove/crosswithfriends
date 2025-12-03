/**
 * Error reporting utilities
 *
 * To integrate Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Initialize in index.tsx:
 *    import * as Sentry from '@sentry/react';
 *    Sentry.init({ dsn: 'YOUR_DSN' });
 * 3. Uncomment the Sentry calls in ErrorBoundary.tsx
 */

import {logger} from './logger';

export interface ErrorContext {
  userId?: string;
  gameId?: string;
  roomId?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Report an error to the error tracking service
 * Currently logs to console, but can be extended to send to Sentry, etc.
 */
export function reportError(error: Error, context?: ErrorContext): void {
  // Log error with context
  logger.errorWithException('Error reported', error, context);

  // TODO: Integrate with error reporting service (e.g., Sentry)
  // Example:
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     contexts: {
  //       custom: context || {},
  //     },
  //     tags: {
  //       component: context?.component || 'unknown',
  //     },
  //   });
  // }
}

/**
 * Track error frequency for analytics
 */
const errorCounts = new Map<string, number>();

export function trackError(errorType: string): void {
  const count = errorCounts.get(errorType) || 0;
  errorCounts.set(errorType, count + 1);

  // Log error frequency (could be sent to analytics service)
  if (count > 0 && count % 10 === 0) {
    logger.warn(`Error type "${errorType}" has occurred ${count} times`);
  }
}

/**
 * Get error statistics
 */
export function getErrorStats(): Record<string, number> {
  return Object.fromEntries(errorCounts);
}

