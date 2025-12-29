/**
 * Loading Spinner Component
 * Implements REQ-7.4.1: Loading spinners during data fetching
 */

import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullScreen?: boolean;
}

const LoadingSpinner = ({ size = 'medium', text, fullScreen = false }: LoadingSpinnerProps) => {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
  };

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 3,
        ...(fullScreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'background.default',
          zIndex: 9999,
        }),
      }}
    >
      <CircularProgress size={sizeMap[size]} thickness={4} />
      {text && (
        <Typography variant="body2" color="text.secondary" className="mt-2">
          {text}
        </Typography>
      )}
    </Box>
  );

  return content;
};

export default LoadingSpinner;
