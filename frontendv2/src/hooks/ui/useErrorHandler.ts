/**
 * Standardized error handling hook
 * Provides consistent error categorization, display, and retry logic
 */

import { useState, useCallback, useRef } from 'react';

export interface ErrorState {
  message: string;
  type: 'network' | 'not-found' | 'validation' | 'server' | 'unknown';
  code?: string;
  originalError?: Error;
}

export interface UseErrorHandlerReturn {
  error: ErrorState | null;
  hasError: boolean;
  setError: (error: string | Error | null) => void;
  clearError: () => void;
  retryAction?: () => void;
  setRetryAction: (action: (() => void) | undefined) => void;

  // Error type checkers
  isNotFoundError: boolean;
  isNetworkError: boolean;
  isServerError: boolean;

  // Display helpers
  getErrorTitle: () => string;
  getErrorCode: () => string;
  getErrorSuggestions: () => string[];
}

/**
 * Categorizes an error based on its message or properties
 */
function categorizeError(error: string | Error): ErrorState {
  const message = typeof error === 'string' ? error : error.message;
  const originalError = typeof error === 'string' ? undefined : error;

  // Not Found errors
  if (
    message.toLowerCase().includes('not found') ||
    message.includes('404') ||
    message.toLowerCase().includes('does not exist')
  ) {
    return {
      message,
      type: 'not-found',
      code: '404',
      originalError,
    };
  }

  // Network errors
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('connection') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('fetch')
  ) {
    return {
      message,
      type: 'network',
      originalError,
    };
  }

  // Server errors
  if (
    message.includes('500') ||
    message.includes('503') ||
    message.toLowerCase().includes('server error') ||
    message.toLowerCase().includes('internal error')
  ) {
    return {
      message,
      type: 'server',
      code: '500',
      originalError,
    };
  }

  // Validation errors
  if (
    message.toLowerCase().includes('validation') ||
    message.toLowerCase().includes('invalid') ||
    message.includes('400')
  ) {
    return {
      message,
      type: 'validation',
      code: '400',
      originalError,
    };
  }

  // Unknown error
  return {
    message,
    type: 'unknown',
    originalError,
  };
}

/**
 * Custom hook for standardized error handling across pages
 *
 * @example
 * const { error, setError, clearError, isNotFoundError, getErrorTitle } = useErrorHandler();
 *
 * // Set error
 * setError('Puzzle not found');
 *
 * // Check error type
 * if (isNotFoundError) {
 *   // Handle 404
 * }
 *
 * // Get display text
 * const title = getErrorTitle();
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setErrorState] = useState<ErrorState | null>(null);
  const retryActionRef = useRef<(() => void) | undefined>();

  const setError = useCallback((error: string | Error | null) => {
    if (error === null) {
      setErrorState(null);
      return;
    }

    setErrorState(categorizeError(error));
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
    retryActionRef.current = undefined;
  }, []);

  const setRetryAction = useCallback((action: (() => void) | undefined) => {
    retryActionRef.current = action;
  }, []);

  const getErrorTitle = useCallback((): string => {
    if (!error) return '';

    switch (error.type) {
      case 'not-found':
        return 'Not Found';
      case 'network':
        return 'Connection Error';
      case 'server':
        return 'Server Error';
      case 'validation':
        return 'Invalid Request';
      default:
        return 'Error';
    }
  }, [error]);

  const getErrorCode = useCallback((): string => {
    if (!error) return '';
    return error.code || '';
  }, [error]);

  const getErrorSuggestions = useCallback((): string[] => {
    if (!error) return [];

    switch (error.type) {
      case 'not-found':
        return [
          'Check that the URL is correct',
          'The resource may have been deleted',
          'Try going back to the home page',
        ];
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again',
        ];
      case 'server':
        return [
          'The server is experiencing issues',
          'Try again in a few moments',
          'Contact support if the problem persists',
        ];
      case 'validation':
        return [
          'Check that your input is valid',
          'Review the requirements',
          'Try a different value',
        ];
      default:
        return [
          'Try refreshing the page',
          'Contact support if the problem persists',
        ];
    }
  }, [error]);

  return {
    error,
    hasError: error !== null,
    setError,
    clearError,
    retryAction: retryActionRef.current,
    setRetryAction,

    // Type checkers
    isNotFoundError: error?.type === 'not-found',
    isNetworkError: error?.type === 'network',
    isServerError: error?.type === 'server',

    // Display helpers
    getErrorTitle,
    getErrorCode,
    getErrorSuggestions,
  };
}
