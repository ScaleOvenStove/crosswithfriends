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
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  borderRadius: theme.shape.borderRadius,
  height: '150px',
  overflowY: 'auto',
  overflowX: 'hidden',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: theme.palette.background.default,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

const HintContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  width: '100%',
}));

const HintHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

const ClueNumber = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.1rem',
  color: theme.palette.primary.main,
}));

const ClueDirection = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.9rem',
  color: theme.palette.text.secondary,
  textTransform: 'capitalize',
}));

const ClueText = styled(Typography)(({ theme }) => ({
  fontSize: '1rem',
  color: theme.palette.text.primary,
  textAlign: 'center',
  lineHeight: 1.5,
}));

const EmptyState = styled(Typography)(({ theme }) => ({
  fontSize: '0.9rem',
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
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
