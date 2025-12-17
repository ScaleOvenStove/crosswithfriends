/**
 * Component-Level Error Boundary
 * Provides graceful error handling for individual components
 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// eslint-disable-next-line no-unused-vars
type ErrorHandler = (error: Error, errorInfo: ErrorInfo) => void;

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
  onError?: ErrorHandler;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ComponentErrorBoundary] Error in ${this.props.componentName || 'component'}:`,
      error,
      errorInfo
    );

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 3,
            textAlign: 'center',
            minHeight: 200,
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {this.props.componentName || 'Component'} Error
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An error occurred'}
          </Typography>
          <Button variant="outlined" onClick={this.handleReset}>
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
