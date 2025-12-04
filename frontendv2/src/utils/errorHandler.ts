/**
 * Error Handler Utility
 * Provides consistent error handling and mapping across the application
 */

import { errorLoggingService } from '@services/errorLogging';

export enum ErrorType {
  NETWORK = 'NETWORK',
  CLIENT = 'CLIENT',
  SERVER = 'SERVER',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  statusCode?: number;
  message: string;
  originalError?: Error | unknown;
  timestamp: Date;
}

/**
 * Detect error type from various error sources
 */
export function detectErrorType(error: unknown): ErrorType {
  // Handle Response objects (fetch API)
  if (error instanceof Response) {
    return mapStatusCodeToErrorType(error.status);
  }

  // Handle Error objects with status codes (axios-like)
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // Check for network errors
    if (err.message === 'Network Error' || err.code === 'ECONNREFUSED') {
      return ErrorType.NETWORK;
    }

    // Check for status code
    if (typeof err.status === 'number') {
      return mapStatusCodeToErrorType(err.status);
    }

    // Check for response object
    if (err.response && typeof err.response === 'object') {
      const response = err.response as Record<string, unknown>;
      if (typeof response.status === 'number') {
        return mapStatusCodeToErrorType(response.status);
      }
    }
  }

  return ErrorType.UNKNOWN;
}

/**
 * Map HTTP status codes to error types
 */
export function mapStatusCodeToErrorType(statusCode: number): ErrorType {
  if (statusCode === 401) {
    return ErrorType.AUTHENTICATION;
  }
  if (statusCode === 403) {
    return ErrorType.AUTHORIZATION;
  }
  if (statusCode === 404) {
    return ErrorType.NOT_FOUND;
  }
  if (statusCode === 503) {
    return ErrorType.SERVICE_UNAVAILABLE;
  }
  if (statusCode >= 400 && statusCode < 500) {
    return ErrorType.CLIENT;
  }
  if (statusCode >= 500) {
    return ErrorType.SERVER;
  }
  return ErrorType.UNKNOWN;
}

/**
 * Create a normalized AppError from any error source
 */
export function normalizeError(error: unknown): AppError {
  const type = detectErrorType(error);
  const timestamp = new Date();

  // Handle Response objects
  if (error instanceof Response) {
    return {
      type,
      statusCode: error.status,
      message: error.statusText || 'An error occurred',
      originalError: error,
      timestamp,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    return {
      type,
      message: error.message,
      originalError: error,
      timestamp,
    };
  }

  // Handle error-like objects
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const statusCode =
      typeof err.status === 'number'
        ? err.status
        : typeof err.response === 'object' && err.response
          ? ((err.response as Record<string, unknown>).status as number)
          : undefined;

    const message = typeof err.message === 'string' ? err.message : 'An error occurred';

    return {
      type,
      statusCode,
      message,
      originalError: error,
      timestamp,
    };
  }

  // Fallback for unknown error types
  return {
    type: ErrorType.UNKNOWN,
    message: String(error) || 'An unknown error occurred',
    originalError: error,
    timestamp,
  };
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'You need to be logged in to access this resource.';
    case ErrorType.AUTHORIZATION:
      return "You don't have permission to access this resource.";
    case ErrorType.NOT_FOUND:
      return 'The requested resource could not be found.';
    case ErrorType.SERVICE_UNAVAILABLE:
      return 'The service is temporarily unavailable. Please try again later.';
    case ErrorType.SERVER:
      return 'An unexpected server error occurred. Our team has been notified.';
    case ErrorType.CLIENT:
      return error.message || 'There was a problem with your request.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Check if error should trigger a specific error page
 */
export function shouldShowErrorPage(error: AppError): boolean {
  return [
    ErrorType.NOT_FOUND,
    ErrorType.AUTHORIZATION,
    ErrorType.SERVER,
    ErrorType.SERVICE_UNAVAILABLE,
  ].includes(error.type);
}

/**
 * Log error to console and external logging service
 */
export function logError(error: AppError, context?: Record<string, unknown>): void {
  const logData = {
    type: error.type,
    statusCode: error.statusCode,
    message: error.message,
    timestamp: error.timestamp.toISOString(),
    context,
  };

  // In development, log full error details
  if (import.meta.env.DEV) {
    console.error('[ErrorHandler]', logData, error.originalError);
  } else {
    // In production, log without stack traces (which might contain sensitive info)
    console.error('[ErrorHandler]', logData);
  }

  // Send to logging service (Sentry, LogRocket, custom backend, etc.)
  errorLoggingService.log(logData);
}

/**
 * Handle errors in a consistent way across the app
 */
export function handleError(error: unknown, context?: Record<string, unknown>): AppError {
  const normalizedError = normalizeError(error);
  logError(normalizedError, context);
  return normalizedError;
}

/**
 * Create error handler for React Query
 */
export function createQueryErrorHandler(context?: Record<string, unknown>) {
  return (error: unknown) => {
    return handleError(error, context);
  };
}
