import {Box, Button, Stack, Typography} from '@mui/material';
import React from 'react';

import {IS_DEVELOPMENT} from '../../config';

export interface ErrorDisplayProps {
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
  onRetry?: () => void;
  onReset?: () => void;
  onNavigateHome?: () => void;
  title?: string;
  showTechnicalDetails?: boolean;
}

export type ErrorType =
  | 'network'
  | 'timeout'
  | 'authentication'
  | 'authorization'
  | 'notFound'
  | 'validation'
  | 'server'
  | 'unknown';

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  recoveryActions: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  suggestions?: string[];
}

/**
 * Categorizes an error and provides user-friendly information
 */
export function categorizeError(error: Error | null): ErrorDetails {
  if (!error) {
    return {
      type: 'unknown',
      message: 'An unexpected error occurred. Please try refreshing the page.',
      recoveryActions: [],
    };
  }

  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('failed to fetch') ||
    errorName === 'networkerror'
  ) {
    return {
      type: 'network',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          primary: true,
        },
        {
          label: 'Check Connection',
          action: () => {
            // Could open network settings or show connection status
            window.location.reload();
          },
        },
      ],
      suggestions: [
        'Check your internet connection',
        'Try disabling VPN or proxy if enabled',
        'Check if the service is down',
      ],
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorName === 'timeouterror') {
    return {
      type: 'timeout',
      message: 'The request took too long to complete. The server may be busy.',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          primary: true,
        },
      ],
      suggestions: ['Try again in a few moments', 'Check your internet connection speed'],
    };
  }

  // Authentication errors
  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('login') ||
    errorMessage.includes('token') ||
    (error as {status?: number}).status === 401
  ) {
    return {
      type: 'authentication',
      message: 'Your session has expired. Please log in again.',
      recoveryActions: [
        {
          label: 'Go to Login',
          action: () => {
            window.location.assign('/account');
          },
          primary: true,
        },
      ],
      suggestions: ['Your session may have expired', 'Please log in again to continue'],
    };
  }

  // Authorization errors
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('access denied') ||
    (error as {status?: number}).status === 403
  ) {
    return {
      type: 'authorization',
      message: "You don't have permission to perform this action.",
      recoveryActions: [
        {
          label: 'Go Home',
          action: () => {
            window.location.assign('/');
          },
          primary: true,
        },
      ],
      suggestions: [
        'You may need different permissions to access this resource',
        'Contact support if you believe this is an error',
      ],
    };
  }

  // Not found errors
  if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    (error as {status?: number}).status === 404
  ) {
    return {
      type: 'notFound',
      message: 'The requested resource was not found.',
      recoveryActions: [
        {
          label: 'Go Home',
          action: () => {
            window.location.assign('/');
          },
          primary: true,
        },
      ],
      suggestions: ['The page or resource you are looking for may have been moved or deleted'],
    };
  }

  // Validation errors
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('invalid') ||
    (error as {status?: number}).status === 400
  ) {
    return {
      type: 'validation',
      message: 'There was a problem with your request. Please check your input and try again.',
      recoveryActions: [
        {
          label: 'Try Again',
          action: () => window.location.reload(),
          primary: true,
        },
      ],
      suggestions: ['Check that all required fields are filled correctly', 'Verify your input format'],
    };
  }

  // Server errors
  if (
    errorMessage.includes('server error') ||
    errorMessage.includes('500') ||
    (error as {status?: number}).status === 500 ||
    (error as {status?: number}).status === 502 ||
    (error as {status?: number}).status === 503
  ) {
    return {
      type: 'server',
      message: 'The server encountered an error. Please try again later.',
      recoveryActions: [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          primary: true,
        },
        {
          label: 'Go Home',
          action: () => {
            window.location.assign('/');
          },
        },
      ],
      suggestions: [
        'The server may be temporarily unavailable',
        'Try again in a few moments',
        'Contact support if the problem persists',
      ],
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message:
      'Something went wrong. Please try refreshing the page or contact support if the problem persists.',
    recoveryActions: [
      {
        label: 'Refresh Page',
        action: () => window.location.reload(),
        primary: true,
      },
      {
        label: 'Go Home',
        action: () => {
          window.location.href = '/';
        },
      },
    ],
    suggestions: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the problem persists',
    ],
  };
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  errorInfo,
  onRetry,
  onReset,
  onNavigateHome,
  title = 'Oops! Something went wrong',
  showTechnicalDetails = IS_DEVELOPMENT,
}) => {
  const errorDetails = categorizeError(error);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  };

  const handleNavigateHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.assign('/');
    }
  };

  return (
    <Box
      sx={{
        padding: '40px 20px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <Typography variant="h4" sx={{color: '#d32f2f', marginBottom: '16px'}}>
        {title}
      </Typography>
      <Typography variant="body1" sx={{margin: '16px 0', color: '#666', fontSize: '16px'}}>
        {errorDetails.message}
      </Typography>

      {errorDetails.suggestions && errorDetails.suggestions.length > 0 && (
        <Box sx={{marginTop: '24px', textAlign: 'left'}}>
          <Typography variant="subtitle2" sx={{marginBottom: '8px', fontWeight: 'bold'}}>
            Suggestions:
          </Typography>
          <ul style={{margin: 0, paddingLeft: '20px', color: '#666'}}>
            {errorDetails.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </Box>
      )}

      <Stack direction="row" spacing={2} justifyContent="center" sx={{marginTop: '24px'}}>
        {errorDetails.recoveryActions.map((action, index) => {
          const handleAction = () => {
            if (action.label === 'Retry' || action.label === 'Try Again' || action.label === 'Refresh Page') {
              handleRetry();
            } else if (action.label === 'Go Home' || action.label === 'Go to Login') {
              handleNavigateHome();
            } else {
              action.action();
            }
          };

          return (
            <Button
              key={index}
              variant={action.primary ? 'contained' : 'outlined'}
              onClick={handleAction}
              sx={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
              }}
            >
              {action.label}
            </Button>
          );
        })}
      </Stack>

      {showTechnicalDetails && error && (
        <Box sx={{marginTop: '32px', textAlign: 'left'}}>
          <details>
            <summary style={{cursor: 'pointer', color: '#666', marginBottom: '8px'}}>
              Technical Details (Development Only)
            </summary>
            <Box
              component="pre"
              sx={{
                marginTop: '10px',
                padding: '16px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                border: '1px solid #ddd',
              }}
            >
              <div>
                <strong>Error:</strong> {error.name}
                <br />
                <strong>Message:</strong> {error.message}
                <br />
                {error.stack && (
                  <>
                    <strong>Stack:</strong>
                    <br />
                    {error.stack}
                  </>
                )}
                {errorInfo && (
                  <>
                    <br />
                    <strong>Component Stack:</strong>
                    <br />
                    {errorInfo.componentStack}
                  </>
                )}
                {'status' in error && (
                  <>
                    <br />
                    <strong>Status:</strong> {(error as {status?: number}).status}
                  </>
                )}
              </div>
            </Box>
          </details>
        </Box>
      )}
    </Box>
  );
};

export default ErrorDisplay;
