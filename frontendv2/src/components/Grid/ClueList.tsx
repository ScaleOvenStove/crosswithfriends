/**
 * ClueList Component - List of clues (Across or Down)
 * Implements REQ-1.4: Clue Display
 *
 * Features:
 * - Scrollable list of clues
 * - Auto-scroll to selected clue
 * - Show completion status
 */

import { useEffect, useRef } from 'react';
import { List, ListItem, Typography, Box, styled } from '@mui/material';
import { ClueItem } from './ClueItem';
import type { Clue } from '@types/index';

interface ClueListProps {
  title: string;
  clues: Clue[];
  currentClue: Clue | null;
  completedClues: Set<string>;
  direction: 'across' | 'down';
  onClueClick: (clue: Clue) => void;
}

const ClueListContainer = styled(Box)(({ _theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const ClueListHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: 'sticky',
  top: 0,
  zIndex: 1,
}));

const ScrollableList = styled(List)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: 0,
  minHeight: 0, // Critical for flex scrolling
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

/**
 * ClueList renders a list of clues for a given direction
 */
export const ClueList = ({
  title,
  clues,
  currentClue,
  completedClues,
  direction,
  onClueClick,
}: ClueListProps) => {
  const selectedRef = useRef<HTMLLIElement>(null);

  // Auto-scroll to selected clue
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentClue]);

  if (!clues || clues.length === 0) {
    return (
      <ClueListContainer>
        <ClueListHeader>
          <Typography variant="h6">{title}</Typography>
        </ClueListHeader>
        <Box p={2}>
          <Typography variant="body2" color="text.secondary">
            No clues available
          </Typography>
        </Box>
      </ClueListContainer>
    );
  }

  return (
    <ClueListContainer>
      <ClueListHeader>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {completedClues.size} of {clues.length} completed
        </Typography>
      </ClueListHeader>

      <ScrollableList>
        {clues.map((clue) => {
          const isSelected =
            currentClue?.number === clue.number && currentClue?.direction === direction;
          const isCompleted = completedClues.has(`${direction}-${clue.number}`);

          return (
            <ListItem
              key={`${direction}-${clue.number}`}
              ref={isSelected ? selectedRef : null}
              disablePadding
            >
              <ClueItem
                clue={clue}
                isSelected={isSelected}
                isCompleted={isCompleted}
                onClick={onClueClick}
              />
            </ListItem>
          );
        })}
      </ScrollableList>
    </ClueListContainer>
  );
};
