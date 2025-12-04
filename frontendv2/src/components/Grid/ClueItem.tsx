/**
 * ClueItem Component - Individual clue display
 * Implements REQ-1.4: Clue Display
 *
 * Features:
 * - Click to navigate to clue in grid
 * - Highlight when selected
 * - Show completion status
 */

import { memo } from 'react';
import { ListItemButton, ListItemText, Chip, Box, styled } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import type { Clue } from '@types/index';

interface ClueItemProps {
  clue: Clue;
  isSelected: boolean;
  isCompleted: boolean;
  onClick: (clue: Clue) => void;
}

const ClueNumber = styled('span')<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  fontWeight: 700,
  marginRight: theme.spacing(1),
  minWidth: '2rem',
  display: 'inline-block',
  color: isSelected && theme.palette.mode === 'dark' 
    ? '#000000' 
    : theme.palette.primary.main,
}));

const CompletionChip = styled(Chip)(({ theme }) => ({
  height: 20,
  '& .MuiChip-icon': {
    fontSize: '0.875rem',
  },
}));

/**
 * ClueItem renders a single clue
 * Memoized to prevent unnecessary re-renders
 */
export const ClueItem = memo<ClueItemProps>(
  ({ clue, isSelected, isCompleted, onClick }) => {
    const handleClick = () => {
      onClick(clue);
    };

    return (
      <ListItemButton
        selected={isSelected}
        onClick={handleClick}
        aria-label={`${clue.direction} ${clue.number}: ${clue.clue}${isCompleted ? ' (completed)' : ''}${isSelected ? ' (selected)' : ''}`}
        aria-current={isSelected ? 'true' : undefined}
        sx={(theme) => ({
          py: 1,
          px: 2,
          '&.Mui-selected': {
            backgroundColor: 'primary.light',
            color: theme.palette.mode === 'dark' ? '#000000' : 'inherit',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
            '& .MuiListItemText-primary': {
              color: theme.palette.mode === 'dark' ? '#000000' : 'inherit',
            },
            '& .MuiChip-root': {
              color: theme.palette.mode === 'dark' ? '#000000' : 'inherit',
              borderColor: theme.palette.mode === 'dark' ? '#000000' : undefined,
            },
          },
        })}
      >
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <ClueNumber 
                aria-label={`Clue number ${clue.number}`}
                isSelected={isSelected}
              >
                {clue.number}
              </ClueNumber>
              <span>{clue.clue}</span>
              {isCompleted && (
                <CompletionChip
                  icon={<CheckIcon aria-hidden="true" />}
                  size="small"
                  color="success"
                  variant="outlined"
                  aria-label="Completed"
                />
              )}
            </Box>
          }
          primaryTypographyProps={{
            variant: 'body2',
            component: 'span',
            sx: {
              fontWeight: isSelected ? 600 : 400,
            },
          }}
        />
      </ListItemButton>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.clue.number === nextProps.clue.number &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isCompleted === nextProps.isCompleted
    );
  }
);

ClueItem.displayName = 'ClueItem';
