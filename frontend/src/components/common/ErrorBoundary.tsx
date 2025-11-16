import React, {Component, ErrorInfo, ReactNode} from 'react';

import {IS_DEVELOPMENT} from '../../config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const getUserFriendlyMessage = (error: Error | null): string => {
        if (!error) return 'An unexpected error occurred. Please try refreshing the page.';

        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          return 'Unable to connect to the server. Please check your internet connection and try again.';
        }
        if (errorMessage.includes('timeout')) {
          return 'The request took too long. Please try again.';
        }
        if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
          return "You don't have permission to perform this action.";
        }
        if (errorMessage.includes('not found')) {
          return 'The requested resource was not found.';
        }

        return 'Something went wrong. Please try refreshing the page or contact support if the problem persists.';
      };

      return (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          <h2 style={{color: '#d32f2f', marginBottom: '16px'}}>Oops! Something went wrong</h2>
          <p style={{margin: '16px 0', color: '#666', fontSize: '16px'}}>
            {getUserFriendlyMessage(this.state.error)}
          </p>
          <div style={{display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px'}}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6aa9f4',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
              }}
              aria-label="Try again"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
              }}
              aria-label="Refresh page"
            >
              Refresh Page
            </button>
          </div>
          {IS_DEVELOPMENT && this.state.error && (
            <details style={{marginTop: '32px', textAlign: 'left'}}>
              <summary style={{cursor: 'pointer', color: '#666', marginBottom: '8px'}}>
                Technical Details (Development Only)
              </summary>
              <pre
                style={{
                  marginTop: '10px',
                  padding: '16px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                }}
              >
                {this.state.error.stack || this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
