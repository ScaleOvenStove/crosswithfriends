/**
 * Error Boundary Component
 * Implements REQ-7.5.2: Error boundaries for React errors
 * Enhanced with proper error pages and error handling
 */

import { Component, ReactNode } from 'react';
import ServerError500 from '@pages/errors/ServerError500';
import { handleError, detectErrorType, ErrorType } from '@utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error with context
    handleError(error, {
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      boundary: 'ErrorBoundary',
    });

    // Check if this is an API error that we should handle differently
    const errorType = detectErrorType(error);

    // Log additional context for API errors
    if (errorType !== ErrorType.UNKNOWN) {
      console.error('[ErrorBoundary] Error type:', errorType);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use the ServerError500 component with reset functionality
      return <ServerError500 error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
