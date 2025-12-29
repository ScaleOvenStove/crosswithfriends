/**
 * Error Boundary Component
 * Uses react-error-boundary for better error handling
 * Implements REQ-7.5.2: Error boundaries for React errors
 */

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import ServerError500 from '@pages/errors/ServerError500';
import * as Sentry from '@sentry/react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  // Log error to Sentry
  Sentry.captureException(error);

  return <ServerError500 error={error} resetError={resetErrorBoundary} />;
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const ErrorBoundary = ({ children, fallback }: ErrorBoundaryProps) => {
  if (fallback) {
    return (
      <ReactErrorBoundary fallback={fallback} onError={(error) => Sentry.captureException(error)}>
        {children}
      </ReactErrorBoundary>
    );
  }

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => Sentry.captureException(error)}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
