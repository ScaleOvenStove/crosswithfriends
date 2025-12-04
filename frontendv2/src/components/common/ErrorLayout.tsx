/**
 * ErrorLayout Component
 * Reusable layout for all error pages with consistent styling
 */

import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { Home as HomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ErrorLayoutProps {
  icon: ReactNode;
  errorCode: string;
  title: string;
  message: string;
  suggestions?: string[];
  showRetry?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
}

export default function ErrorLayout({
  icon,
  errorCode,
  title,
  message,
  suggestions = [],
  showRetry = false,
  onRetry,
  children,
}: ErrorLayoutProps) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <Container maxWidth="md" component="main" role="main">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          py: 4,
        }}
      >
        {/* Error Icon */}
        <Box
          sx={{
            fontSize: { xs: 80, sm: 120 },
            color: 'error.main',
            mb: 2,
            opacity: 0.9,
          }}
          role="img"
          aria-label="Error icon"
        >
          {icon}
        </Box>

        {/* Error Code */}
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
            fontWeight: 700,
            color: 'text.primary',
            mb: 1,
          }}
        >
          {errorCode}
        </Typography>

        {/* Error Title */}
        <Typography
          variant="h2"
          component="h2"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem' },
            fontWeight: 600,
            color: 'text.primary',
            mb: 2,
          }}
        >
          {title}
        </Typography>

        {/* Error Message */}
        <Typography
          variant="body1"
          component="p"
          sx={{
            fontSize: { xs: '1rem', sm: '1.125rem' },
            color: 'text.secondary',
            mb: 4,
            maxWidth: '600px',
          }}
        >
          {message}
        </Typography>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Box
            component="section"
            sx={{ mb: 4, textAlign: 'left', maxWidth: '600px', width: '100%' }}
            aria-labelledby="suggestions-heading"
          >
            <Typography
              id="suggestions-heading"
              variant="subtitle1"
              component="h3"
              sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}
            >
              Here's what you can try:
            </Typography>
            <Box component="ul" sx={{ margin: 0, paddingLeft: '1.5rem', listStyle: 'disc' }}>
              {suggestions.map((suggestion, index) => (
                <Box component="li" key={index} sx={{ mb: 0.5 }}>
                  <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>
                    {suggestion}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Custom Children Content */}
        {children && (
          <Box component="section" sx={{ mb: 4, width: '100%', maxWidth: '600px' }}>
            {children}
          </Box>
        )}

        {/* Action Buttons */}
        <Stack
          component="nav"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          aria-label="Error page actions"
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<HomeIcon aria-hidden="true" />}
            onClick={handleGoHome}
            sx={{ minWidth: 150 }}
            aria-label="Go to home page"
          >
            Go Home
          </Button>
          {showRetry && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<RefreshIcon aria-hidden="true" />}
              onClick={handleRetry}
              sx={{ minWidth: 150 }}
              aria-label="Try again"
            >
              Try Again
            </Button>
          )}
        </Stack>
      </Box>
    </Container>
  );
}
