/**
 * Isolated Clock Display Component
 * Prevents unnecessary re-renders of parent components
 */

import { memo } from 'react';
import { Box, Typography, ButtonGroup, Button, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const TimerDisplay = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: '1.25rem',
  fontWeight: 700,
}));

/**
 * Format time in seconds to MM:SS format
 */
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface ClockDisplayProps {
  elapsedTime: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

/**
 * Isolated clock display component
 * Only re-renders when clock state changes, not when parent re-renders
 */
export const ClockDisplay = memo<ClockDisplayProps>(
  ({ elapsedTime, isRunning, onStart, onPause, onReset }) => {
    return (
      <TimerDisplay>
        <AccessTimeIcon fontSize="small" />
        <Typography variant="h6" component="span">
          {formatTime(elapsedTime)}
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          {isRunning ? (
            <Tooltip title="Pause">
              <Button onClick={onPause} size="small">
                <PauseIcon fontSize="small" />
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Start">
              <Button onClick={onStart} size="small">
                <PlayArrowIcon fontSize="small" />
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Reset Timer">
            <Button onClick={onReset} size="small">
              <RestartAltIcon fontSize="small" />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </TimerDisplay>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if clock state actually changed
    return (
      prevProps.elapsedTime === nextProps.elapsedTime && prevProps.isRunning === nextProps.isRunning
    );
  }
);

ClockDisplay.displayName = 'ClockDisplay';
