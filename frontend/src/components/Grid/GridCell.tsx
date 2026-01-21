/**
 * GridCell Component - Individual cell in crossword grid
 * Implements REQ-1.2: Grid Interaction
 *
 * Following React best practices:
 * - Single responsibility: renders one cell
 * - Proper accessibility (ARIA labels, keyboard navigation)
 * - Memoized for performance
 */

import { memo, useRef, useEffect } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import type { Cell, Cursor, User } from '../../types';

interface GridCellProps {
  cell: Cell;
  row: number;
  col: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isInCurrentWord: boolean;
  onCellClick: (row: number, col: number) => void;
  onCellChange: (row: number, col: number, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
  cursorColor?: string;
  otherCursors?: Cursor[];
  users?: User[];
}

// Animations for check feedback
const checkError = keyframes`
  0% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
  100% {
    transform: translateX(0);
  }
`;

const checkSuccess = keyframes`
  0% {
    transform: scale(1);
    background-color: rgba(76, 175, 80, 0.15);
  }
  50% {
    transform: scale(1.05);
    background-color: rgba(76, 175, 80, 0.25);
  }
  100% {
    transform: scale(1);
    background-color: rgba(76, 175, 80, 0.15);
  }
`;

const checkmarkAppear = keyframes`
  0% {
    opacity: 0;
    transform: scale(0);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

const CellContainer = styled('div')<{
  isBlack?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isInCurrentWord?: boolean;
  isGood?: boolean;
  isBad?: boolean;
  isRevealed?: boolean;
  cursorColor?: string;
  otherCursorColors?: string[];
}>(({
  theme,
  isBlack,
  isSelected,
  isHighlighted,
  isInCurrentWord,
  isGood,
  isBad,
  isRevealed,
  cursorColor,
  otherCursorColors,
}) => {
  // Determine background color based on state priority
  let backgroundColor = theme.palette.background.paper;

  if (isBlack) {
    backgroundColor = theme.palette.mode === 'dark' ? '#000000' : theme.palette.grey[900];
  } else if (isBad) {
    // Red background for incorrect cells
    backgroundColor = 'rgba(244, 67, 54, 0.15)';
  } else if (isRevealed) {
    // Purple transparent (matching theme.palette.secondary.main #9c27b0)
    backgroundColor = 'rgba(156, 39, 176, 0.15)';
  } else if (isGood) {
    // Green background for correct cells
    backgroundColor = 'rgba(76, 175, 80, 0.15)';
  } else if (isSelected) {
    backgroundColor = cursorColor || theme.palette.primary.light;
  } else if (otherCursorColors && otherCursorColors.length > 0) {
    // Highlight with other users' cursor colors (semi-transparent overlay)
    // Use the first cursor color, or blend if multiple
    const primaryCursorColor = otherCursorColors[0];
    backgroundColor = `${primaryCursorColor}40`; // Add alpha channel (25% opacity)
  } else if (isInCurrentWord) {
    backgroundColor = theme.palette.action.hover;
  } else if (isHighlighted) {
    backgroundColor = theme.palette.action.selected;
  }

  return {
    position: 'relative',
    width: '32px',
    height: '32px',
    minWidth: '28px',
    minHeight: '28px',
    maxWidth: '50px',
    maxHeight: '50px',
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isBlack ? 'default' : 'pointer',
    transition: 'background-color 0.15s ease',
    userSelect: 'none',
    animation: isBad
      ? `${checkError} 0.4s ease-out`
      : isGood
        ? `${checkSuccess} 0.5s ease-out`
        : 'none',

    [theme.breakpoints.up('sm')]: {
      width: '36px',
      height: '36px',
      minWidth: '32px',
      minHeight: '32px',
    },
    [theme.breakpoints.up('md')]: {
      width: '40px',
      height: '40px',
      minWidth: '30px',
      minHeight: '30px',
    },

    '&:focus-within': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '-2px',
      zIndex: 1,
    },
  };
});

const CellNumber = styled('span')(({ theme }) => ({
  position: 'absolute',
  top: 2,
  left: 3,
  fontSize: '0.55rem',
  fontWeight: 600,
  color: theme.palette.text.secondary,
  lineHeight: 1,
  pointerEvents: 'none',
  [theme.breakpoints.up('sm')]: {
    fontSize: '0.6rem',
  },
  [theme.breakpoints.up('md')]: {
    fontSize: '0.65rem',
  },
}));

const CellInput = styled('input')<{
  isPencil?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isInCurrentWord?: boolean;
  isGood?: boolean;
  isBad?: boolean;
  isRevealed?: boolean;
}>(({ theme, isPencil, isSelected, isHighlighted, isInCurrentWord, isGood, isBad, isRevealed }) => {
  // Determine if we need dark text (for light backgrounds in dark mode)
  const needsDarkText =
    theme.palette.mode === 'dark' && (isSelected || isHighlighted || isInCurrentWord);

  // Determine text color based on check state
  let textColor = theme.palette.text.primary;
  if (isBad) {
    textColor = '#d32f2f'; // Red for incorrect
  } else if (isGood) {
    textColor = '#2e7d32'; // Green for correct
  } else if (isRevealed) {
    textColor = '#7b1fa2'; // Purple for revealed (secondary.dark)
  } else if (isPencil) {
    textColor = theme.palette.text.secondary;
  } else if (needsDarkText) {
    textColor = '#000000';
  }

  return {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    fontSize: isPencil ? '0.85rem' : '1.2rem',
    fontWeight: isPencil ? 400 : isGood || isBad ? 600 : 700,
    color: textColor,
    textTransform: 'uppercase',
    fontStyle: isPencil ? 'italic' : 'normal',
    outline: 'none',
    cursor: 'pointer',
    caretColor: 'transparent',
    position: 'relative',

    [theme.breakpoints.up('sm')]: {
      fontSize: isPencil ? '0.95rem' : '1.35rem',
    },
    [theme.breakpoints.up('md')]: {
      fontSize: isPencil ? '1rem' : '1.5rem',
    },

    '&::selection': {
      background: 'transparent',
    },

    '&:disabled': {
      cursor: 'default',
    },
  };
});

const Circle = styled('div')(({ theme }) => ({
  position: 'absolute',
  width: '80%',
  height: '80%',
  border: `2px solid ${theme.palette.primary.main}`,
  borderRadius: '50%',
  pointerEvents: 'none',
}));

/**
 * GridCell renders a single cell in the crossword grid
 * Memoized to prevent unnecessary re-renders
 */
// Cursor indicator component
const CursorIndicator = styled('div')<{ color: string }>(({ color }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  border: `2px solid ${color}`,
  borderRadius: '2px',
  pointerEvents: 'none',
  zIndex: 1,
}));

export const GridCell = memo<GridCellProps>(
  ({
    cell,
    row,
    col,
    isSelected,
    isHighlighted,
    isInCurrentWord,
    onCellClick,
    onCellChange,
    onKeyDown,
    cursorColor,
    otherCursors = [],
    users = [],
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when cell is selected
    useEffect(() => {
      if (isSelected && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isSelected]);

    // Don't render interactive elements for black squares
    if (cell.isBlack) {
      return <CellContainer isBlack />;
    }

    const handleClick = () => {
      onCellClick(row, col);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toUpperCase();
      // Only allow single letter
      if (value.length <= 1 && /^[A-Z]*$/.test(value)) {
        onCellChange(row, col, value);
      } else if (value.length === 0) {
        // Allow clearing the cell
        onCellChange(row, col, '');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Let the keyboard navigation hook handle navigation
      // But we need to handle letter input here to prevent default behavior
      if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
        // Prevent default to avoid the input showing the letter before we process it
        e.preventDefault();
        // Update the cell with the uppercase letter
        const upperKey = e.key.toUpperCase();
        onCellChange(row, col, upperKey);
        // Let the navigation hook handle moving to next cell
        onKeyDown(e, row, col);
      } else {
        // For other keys (arrows, backspace, etc.), just pass through
        onKeyDown(e, row, col);
      }
    };

    // Get cursor colors for other users on this cell
    const otherCursorColors = otherCursors
      .map((cursor) => {
        const user = users.find((u) => u.id === cursor.id);
        return user?.color;
      })
      .filter((color): color is string => !!color);

    return (
      <CellContainer
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        isInCurrentWord={isInCurrentWord}
        isGood={cell.isGood}
        isBad={cell.isBad}
        isRevealed={cell.isRevealed}
        cursorColor={cursorColor}
        otherCursorColors={otherCursorColors}
        onClick={handleClick}
        data-row={row}
        data-col={col}
        role="gridcell"
        aria-label={`Row ${row + 1}, Column ${col + 1}${cell.number ? `, Clue ${cell.number}` : ''}`}
      >
        {cell.number && <CellNumber>{cell.number}</CellNumber>}
        <CellInput
          ref={inputRef}
          type="text"
          value={cell.value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={1}
          isPencil={cell.isPencil}
          isSelected={isSelected}
          isHighlighted={isHighlighted}
          isInCurrentWord={isInCurrentWord}
          isGood={cell.isGood}
          isBad={cell.isBad}
          isRevealed={cell.isRevealed}
          aria-label={`Cell ${row}-${col} input`}
          tabIndex={isSelected ? 0 : -1}
          disabled={cell.isRevealed}
        />
        {cell.hasCircle && <Circle />}
        {/* Show cursor indicators for other users */}
        {otherCursorColors.map((color, idx) => (
          <CursorIndicator
            key={`cursor-${idx}`}
            color={color}
            style={{
              borderWidth: idx === 0 ? '2px' : '1px',
              opacity: idx === 0 ? 1 : 0.7,
            }}
          />
        ))}
        {cell.isGood && (
          <span
            style={{
              position: 'absolute',
              right: '-8px',
              top: '-2px',
              color: '#4caf50',
              fontSize: '0.6em',
              fontWeight: 'bold',
              animation: `${checkmarkAppear} 0.3s ease-out 0.2s both`,
            }}
          >
            ✓
          </span>
        )}
      </CellContainer>
    );
  },
  // Custom comparison function for better performance
  (prevProps, nextProps) => {
    return (
      prevProps.cell.value === nextProps.cell.value &&
      prevProps.cell.isPencil === nextProps.cell.isPencil &&
      prevProps.cell.isGood === nextProps.cell.isGood &&
      prevProps.cell.isBad === nextProps.cell.isBad &&
      prevProps.cell.isRevealed === nextProps.cell.isRevealed &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.isInCurrentWord === nextProps.isInCurrentWord &&
      prevProps.cursorColor === nextProps.cursorColor &&
      prevProps.otherCursors?.length === nextProps.otherCursors?.length &&
      prevProps.users?.length === nextProps.users?.length
    );
  }
);

GridCell.displayName = 'GridCell';
