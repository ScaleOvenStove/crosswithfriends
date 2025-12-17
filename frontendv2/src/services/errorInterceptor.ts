/**
 * Centralized Error Interceptor
 * Provides consistent error handling across the application
 */

import { ResponseError } from '@api/generated';

export interface ErrorContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

export interface StandardizedError {
  message: string;
  code?: string;
  status?: number;
  originalError?: unknown;
  context?: ErrorContext;
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    return error.message || `HTTP ${error.response.status}: ${error.response.statusText}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

/**
 * Extract error details from ResponseError
 */
export function extractErrorDetails(error: ResponseError): {
  status: number;
  statusText: string;
  body?: unknown;
  url?: string;
} {
  const details: {
    status: number;
    statusText: string;
    body?: unknown;
    url?: string;
  } = {
    status: error.response.status,
    statusText: error.response.statusText,
  };

  // Try to extract body (non-destructively)
  try {
    const clonedResponse = error.response.clone();
    clonedResponse
      .json()
      .then((body) => {
        details.body = body;
      })
      .catch(() => {
        // Ignore JSON parsing errors
      });
  } catch {
    // Ignore clone errors
  }

  if (error.response.url) {
    details.url = error.response.url;
  }

  return details;
}

/**
 * Standardize an error into a consistent format
 */
export function standardizeError(error: unknown, context?: ErrorContext): StandardizedError {
  const standardized: StandardizedError = {
    message: extractErrorMessage(error),
    context,
  };

  if (error instanceof ResponseError) {
    standardized.status = error.response.status;
    standardized.code = `HTTP_${error.response.status}`;
    standardized.originalError = error;
  } else if (error instanceof Error) {
    standardized.originalError = error;
  }

  return standardized;
}

/**
 * Create user-friendly error message
 */
export function createUserFriendlyMessage(error: StandardizedError): string {
  if (error.status === 404) {
    return 'The requested resource was not found. It may have been deleted or the ID is incorrect.';
  }
  if (error.status === 500) {
    return 'A server error occurred. Please try again later.';
  }
  if (error.status && error.status >= 400) {
    return `Request failed (HTTP ${error.status}). ${error.message}`;
  }
  return error.message || 'An unexpected error occurred';
}

/**
 * Log error with context
 */
export function logError(
  error: StandardizedError,
  logger?: {
    error: (message: string, ...args: unknown[]) => void;
  }
): void {
  const logMessage = `[ErrorInterceptor] ${error.message}`;
  const logData = {
    code: error.code,
    status: error.status,
    context: error.context,
    originalError: error.originalError,
  };

  if (logger) {
    logger.error(logMessage, logData);
  } else {
    console.error(logMessage, logData);
  }
}
