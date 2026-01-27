/**
 * ActiveHint Component - Displays the current active clue above the game board
 * Shows the clue number, direction, and clue text for the currently selected cell
 */

import { Box, Paper, Typography, styled } from '@mui/material';
import type { Clue } from '@types/index';

interface ActiveHintProps {
  currentClue: Clue | null;
}

const HintContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius * 1.5,
  boxShadow:
    theme.palette.mode === 'light'
      ? '0 2px 12px rgba(44, 62, 80, 0.06), 0 1px 4px rgba(44, 62, 80, 0.04)'
      : '0 2px 12px rgba(0, 0, 0, 0.4), 0 1px 4px rgba(0, 0, 0, 0.3)',
  minHeight: '60px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  flexShrink: 0,
}));

const HintContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(0.75),
  width: '100%',
}));

const HintHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const ClueNumber = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1rem',
  color: theme.palette.primary.main,
  fontFamily: 'var(--font-display)',
  letterSpacing: '-0.01em',
}));

const ClueDirection = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: 'var(--font-display)',
}));

const ClueText = styled(Typography)(({ theme }) => ({
  fontSize: '0.9375rem',
  color: theme.palette.text.primary,
  textAlign: 'left',
  lineHeight: 1.5,
  fontFamily: 'var(--font-display)',
}));

const EmptyState = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
  fontFamily: 'var(--font-display)',
  textAlign: 'center',
  width: '100%',
}));

/**
 * ActiveHint displays the current clue being worked on
 */
export const ActiveHint = ({ currentClue }: ActiveHintProps) => {
  if (!currentClue) {
    return (
      <HintContainer elevation={2}>
        <EmptyState>Select a cell to see the clue</EmptyState>
      </HintContainer>
    );
  }

  return (
    <HintContainer elevation={2}>
      <HintContent>
        <HintHeader>
          <ClueNumber>{currentClue.number}</ClueNumber>
          <ClueDirection>{currentClue.direction}</ClueDirection>
        </HintHeader>
        <ClueText>{currentClue.clue || 'No clue available'}</ClueText>
      </HintContent>
    </HintContainer>
  );
};

export default ActiveHint;
