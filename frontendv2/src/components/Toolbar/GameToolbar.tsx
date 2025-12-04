/**
 * GameToolbar Component - Game controls and tools
 * Implements REQ-1.3: Game Tools
 *
 * Features:
 * - Check, Reveal, Reset (cell/word/puzzle)
 * - Pencil mode toggle
 * - Auto-check mode toggle
 * - Timer display and controls
 */

import { useState } from 'react';
import {
  Box,
  ButtonGroup,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Divider,
  Tooltip,
  styled,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Visibility as RevealIcon,
  RestartAlt as ResetIcon,
  Edit as PencilIcon,
  Timer as TimerIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';

interface GameToolbarProps {
  isPencilMode: boolean;
  isAutoCheckMode: boolean;
  isComplete: boolean;
  clockTime: number;
  isClockRunning: boolean;
  onTogglePencil: () => void;
  onToggleAutoCheck: () => void;
  onStartClock: () => void;
  onPauseClock: () => void;
  onResetClock: () => void;
  onCheck: (scope: 'cell' | 'word' | 'puzzle') => void;
  onReveal: (scope: 'cell' | 'word' | 'puzzle') => void;
  onReset: (scope: 'cell' | 'word' | 'puzzle') => void;
}

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexWrap: 'wrap',
}));

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

/**
 * GameToolbar component
 */
export const GameToolbar = ({
  isPencilMode,
  isAutoCheckMode,
  isComplete,
  clockTime,
  isClockRunning,
  onTogglePencil,
  onToggleAutoCheck,
  onStartClock,
  onPauseClock,
  onResetClock,
  onCheck,
  onReveal,
  onReset,
}: GameToolbarProps) => {
  const [checkAnchor, setCheckAnchor] = useState<null | HTMLElement>(null);
  const [revealAnchor, setRevealAnchor] = useState<null | HTMLElement>(null);
  const [resetAnchor, setResetAnchor] = useState<null | HTMLElement>(null);

  const handleCheckClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setCheckAnchor(event.currentTarget);
  };

  const handleRevealClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setRevealAnchor(event.currentTarget);
  };

  const handleResetClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setResetAnchor(event.currentTarget);
  };

  const handleCheckOption = (scope: 'cell' | 'word' | 'puzzle') => {
    onCheck(scope);
    setCheckAnchor(null);
  };

  const handleRevealOption = (scope: 'cell' | 'word' | 'puzzle') => {
    onReveal(scope);
    setRevealAnchor(null);
  };

  const handleResetOption = (scope: 'cell' | 'word' | 'puzzle') => {
    onReset(scope);
    setResetAnchor(null);
  };

  return (
    <ToolbarContainer>
      {/* Timer Section */}
      <TimerDisplay>
        <TimerIcon />
        <Typography variant="h6" component="span">
          {formatTime(clockTime)}
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          {isClockRunning ? (
            <Tooltip title="Pause">
              <Button onClick={onPauseClock}>
                <PauseIcon fontSize="small" />
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Start">
              <Button onClick={onStartClock}>
                <PlayIcon fontSize="small" />
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Reset Timer">
            <Button onClick={onResetClock}>
              <ResetIcon fontSize="small" />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </TimerDisplay>

      <Divider orientation="vertical" flexItem />

      {/* Game Tool Buttons */}
      <ButtonGroup variant="contained" size="medium">
        <Tooltip title="Check answers">
          <Button startIcon={<CheckIcon />} onClick={handleCheckClick} color="primary">
            Check
          </Button>
        </Tooltip>
        <Tooltip title="Reveal answers">
          <Button startIcon={<RevealIcon />} onClick={handleRevealClick} color="secondary">
            Reveal
          </Button>
        </Tooltip>
        <Tooltip title="Clear cells">
          <Button startIcon={<ResetIcon />} onClick={handleResetClick} color="warning">
            Reset
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* Check Menu */}
      <Menu anchorEl={checkAnchor} open={Boolean(checkAnchor)} onClose={() => setCheckAnchor(null)}>
        <MenuItem onClick={() => handleCheckOption('cell')}>Check Cell</MenuItem>
        <MenuItem onClick={() => handleCheckOption('word')}>Check Word</MenuItem>
        <MenuItem onClick={() => handleCheckOption('puzzle')}>Check Puzzle</MenuItem>
      </Menu>

      {/* Reveal Menu */}
      <Menu
        anchorEl={revealAnchor}
        open={Boolean(revealAnchor)}
        onClose={() => setRevealAnchor(null)}
      >
        <MenuItem onClick={() => handleRevealOption('cell')}>Reveal Cell</MenuItem>
        <MenuItem onClick={() => handleRevealOption('word')}>Reveal Word</MenuItem>
        <MenuItem onClick={() => handleRevealOption('puzzle')}>Reveal Puzzle</MenuItem>
      </Menu>

      {/* Reset Menu */}
      <Menu anchorEl={resetAnchor} open={Boolean(resetAnchor)} onClose={() => setResetAnchor(null)}>
        <MenuItem onClick={() => handleResetOption('cell')}>Reset Cell</MenuItem>
        <MenuItem onClick={() => handleResetOption('word')}>Reset Word</MenuItem>
        <MenuItem onClick={() => handleResetOption('puzzle')}>Reset Puzzle</MenuItem>
      </Menu>

      <Divider orientation="vertical" flexItem />

      {/* Mode Toggles */}
      <ToggleButtonGroup size="small" exclusive>
        <ToggleButton value="pencil" selected={isPencilMode} onChange={onTogglePencil}>
          <Tooltip title="Pencil mode for tentative entries">
            <Box display="flex" alignItems="center" gap={0.5}>
              <PencilIcon fontSize="small" />
              <span>Pencil</span>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControlLabel
        control={<Switch checked={isAutoCheckMode} onChange={onToggleAutoCheck} />}
        label="Auto-check"
      />

      {isComplete && (
        <Typography variant="h6" color="success.main" sx={{ ml: 'auto' }}>
          🎉 Puzzle Complete!
        </Typography>
      )}
    </ToolbarContainer>
  );
};

export default GameToolbar;
