/**
 * Keyboard Navigation Hook
 * Uses react-hotkeys-hook for declarative keyboard shortcuts
 * Implements REQ-1.2.4: Grid navigation using arrow keys
 *
 * Handles:
 * - Arrow key navigation
 * - Backspace/Delete for clearing cells
 * - Letter input for moving to next cell
 * - Space for toggling direction
 * - Period (.) for pencil mode toggle
 * - Alt+S/W/P for check square/word/puzzle
 * - Alt+Shift+S/W/P for reveal square/word/puzzle
 * - [ and ] or Shift+Arrow for perpendicular movement
 * - Tab/Shift+Tab for next/previous unfilled clue
 * - Home/End for beginning/end of current clue
 */

import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { Cell, Clue } from '../../types';
import { useGameStore } from '@stores/gameStore';

interface UseKeyboardNavigationProps {
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  onCellSelect: (row: number, col: number) => void;
  onCellUpdate: (row: number, col: number, value: string) => void;
  onDirectionToggle: () => void;
  onTogglePencil?: () => void;
  onCheck?: (scope: 'cell' | 'word' | 'puzzle') => void;
  onReveal?: (scope: 'cell' | 'word' | 'puzzle') => void;
  clues?: { across: Clue[]; down: Clue[] };
  enabled?: boolean;
}

interface NavigationHandlers {
  handleKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
}

/**
 * Find the next non-black cell in the given direction
 */
const findNextCell = (
  cells: Cell[][],
  row: number,
  col: number,
  rowDelta: number,
  colDelta: number
): { row: number; col: number } | null => {
  if (!cells || cells.length === 0 || !cells[0] || cells[0].length === 0) {
    return null;
  }

  let newRow = row + rowDelta;
  let newCol = col + colDelta;

  // Check bounds
  while (newRow >= 0 && newRow < cells.length && newCol >= 0 && newCol < cells[0].length) {
    const cell = cells[newRow]?.[newCol];
    // Skip black squares
    if (cell && !cell.isBlack) {
      return { row: newRow, col: newCol };
    }
    newRow += rowDelta;
    newCol += colDelta;
  }

  return null;
};

/**
 * Find the start of a word (clue) given a cell position and direction
 */
const findWordStart = (
  cells: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down'
): { row: number; col: number } => {
  const rowCells = cells[row];
  if (direction === 'across') {
    let startCol = col;
    while (startCol > 0 && rowCells && !rowCells[startCol - 1]?.isBlack) {
      startCol--;
    }
    return { row, col: startCol };
  } else {
    let startRow = row;
    while (startRow > 0) {
      const prevRowCells = cells[startRow - 1];
      if (!prevRowCells || prevRowCells[col]?.isBlack) break;
      startRow--;
    }
    return { row: startRow, col };
  }
};

/**
 * Find the end of a word (clue) given a cell position and direction
 */
const findWordEnd = (
  cells: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down'
): { row: number; col: number } => {
  const rowCells = cells[row];
  if (direction === 'across') {
    let endCol = col;
    while (rowCells && endCol < rowCells.length - 1 && !rowCells[endCol + 1]?.isBlack) {
      endCol++;
    }
    return { row, col: endCol };
  } else {
    let endRow = row;
    while (endRow < cells.length - 1) {
      const nextRowCells = cells[endRow + 1];
      if (!nextRowCells || nextRowCells[col]?.isBlack) break;
      endRow++;
    }
    return { row: endRow, col };
  }
};

/**
 * Check if a word has any unfilled cells
 */
const hasUnfilledCells = (
  cells: Cell[][],
  startRow: number,
  startCol: number,
  direction: 'across' | 'down'
): boolean => {
  const rowCells = cells[startRow];
  if (direction === 'across') {
    let col = startCol;
    while (rowCells && col < rowCells.length) {
      const cell = rowCells[col];
      if (!cell || cell.isBlack) break;
      if (!cell.value) {
        return true;
      }
      col++;
    }
  } else {
    let row = startRow;
    while (row < cells.length) {
      const currentRowCells = cells[row];
      const cell = currentRowCells?.[startCol];
      if (!cell || cell.isBlack) break;
      if (!cell.value) {
        return true;
      }
      row++;
    }
  }
  return false;
};

/**
 * Find the first unfilled cell in a word
 */
const findFirstUnfilledInWord = (
  cells: Cell[][],
  startRow: number,
  startCol: number,
  direction: 'across' | 'down'
): { row: number; col: number } | null => {
  const rowCells = cells[startRow];
  if (direction === 'across') {
    let col = startCol;
    while (rowCells && col < rowCells.length) {
      const cell = rowCells[col];
      if (!cell || cell.isBlack) break;
      if (!cell.value) {
        return { row: startRow, col };
      }
      col++;
    }
  } else {
    let row = startRow;
    while (row < cells.length) {
      const currentRowCells = cells[row];
      const cell = currentRowCells?.[startCol];
      if (!cell || cell.isBlack) break;
      if (!cell.value) {
        return { row, col: startCol };
      }
      row++;
    }
  }
  return null;
};

/**
 * Find the starting cell for a clue number
 */
const findClueStartCell = (
  cells: Cell[][],
  clueNumber: number
): { row: number; col: number } | null => {
  for (let row = 0; row < cells.length; row++) {
    const rowCells = cells[row];
    if (!rowCells) continue;
    for (let col = 0; col < rowCells.length; col++) {
      if (rowCells[col]?.number === clueNumber) {
        return { row, col };
      }
    }
  }
  return null;
};

/**
 * Hook for managing keyboard navigation in the crossword grid
 * Returns handlers for keyboard events
 */
export const useKeyboardNavigation = ({
  cells,
  selectedCell,
  onCellSelect,
  onCellUpdate,
  onDirectionToggle,
  onTogglePencil,
  onCheck,
  onReveal,
  clues,
  enabled = true,
}: UseKeyboardNavigationProps): NavigationHandlers => {
  /**
   * Move in the current selected direction (across or down)
   * Uses store state directly to avoid stale closures
   */
  const moveInDirection = useCallback(
    (forward: boolean = true) => {
      const currentState = useGameStore.getState();
      const currentSelectedCell = currentState.selectedCell;
      const currentDirection = currentState.selectedDirection;

      if (!currentSelectedCell) return;

      const delta = forward ? 1 : -1;
      const rowDelta = currentDirection === 'down' ? delta : 0;
      const colDelta = currentDirection === 'across' ? delta : 0;

      const nextCell = findNextCell(
        cells,
        currentSelectedCell.row,
        currentSelectedCell.col,
        rowDelta,
        colDelta
      );
      if (nextCell) {
        onCellSelect(nextCell.row, nextCell.col);
      }
    },
    [cells, onCellSelect]
  );

  /**
   * Move perpendicular to the current direction without changing orientation
   */
  const movePerpendicular = useCallback(
    (forward: boolean = true) => {
      const currentState = useGameStore.getState();
      const currentSelectedCell = currentState.selectedCell;
      const currentDirection = currentState.selectedDirection;

      if (!currentSelectedCell) return;

      const delta = forward ? 1 : -1;
      // Perpendicular to current direction
      const rowDelta = currentDirection === 'across' ? delta : 0;
      const colDelta = currentDirection === 'down' ? delta : 0;

      const nextCell = findNextCell(
        cells,
        currentSelectedCell.row,
        currentSelectedCell.col,
        rowDelta,
        colDelta
      );
      if (nextCell) {
        onCellSelect(nextCell.row, nextCell.col);
      }
    },
    [cells, onCellSelect]
  );

  /**
   * Navigate to the next or previous unfilled clue
   */
  const navigateToUnfilledClue = useCallback(
    (forward: boolean = true) => {
      const currentState = useGameStore.getState();
      const currentSelectedCell = currentState.selectedCell;
      const currentDirection = currentState.selectedDirection;

      if (!currentSelectedCell || !clues) return;

      const allClues: { clue: Clue; direction: 'across' | 'down' }[] = [
        ...clues.across.map((c) => ({ clue: c, direction: 'across' as const })),
        ...clues.down.map((c) => ({ clue: c, direction: 'down' as const })),
      ];

      // Sort clues by number for consistent ordering
      allClues.sort((a, b) => {
        if (a.clue.number !== b.clue.number) {
          return a.clue.number - b.clue.number;
        }
        return a.direction === 'across' ? -1 : 1;
      });

      // Find current clue index
      const wordStart = findWordStart(
        cells,
        currentSelectedCell.row,
        currentSelectedCell.col,
        currentDirection
      );
      const currentClueCell = cells[wordStart.row]?.[wordStart.col];
      const currentClueNumber = currentClueCell?.number;

      let currentIndex = allClues.findIndex(
        (c) => c.clue.number === currentClueNumber && c.direction === currentDirection
      );

      if (currentIndex === -1) {
        currentIndex = 0;
      }

      // Find next unfilled clue
      const step = forward ? 1 : -1;
      let iterations = 0;
      let nextIndex = currentIndex;

      do {
        nextIndex = (nextIndex + step + allClues.length) % allClues.length;
        iterations++;

        const nextClueItem = allClues[nextIndex];
        if (!nextClueItem) continue;

        const startCell = findClueStartCell(cells, nextClueItem.clue.number);

        if (
          startCell &&
          hasUnfilledCells(cells, startCell.row, startCell.col, nextClueItem.direction)
        ) {
          // Found an unfilled clue, navigate to first unfilled cell
          const unfilledCell = findFirstUnfilledInWord(
            cells,
            startCell.row,
            startCell.col,
            nextClueItem.direction
          );
          if (unfilledCell) {
            // Atomically set both cell and direction to avoid intermediate inconsistent state
            useGameStore
              .getState()
              .setSelectedCellAndDirection(
                unfilledCell.row,
                unfilledCell.col,
                nextClueItem.direction
              );
            return;
          }
        }
      } while (iterations < allClues.length);

      // If all clues are filled, just go to the next/previous clue's start
      const fallbackClue = allClues[(currentIndex + step + allClues.length) % allClues.length];
      if (fallbackClue) {
        const startCell = findClueStartCell(cells, fallbackClue.clue.number);
        if (startCell) {
          // Atomically set both cell and direction to avoid intermediate inconsistent state
          useGameStore
            .getState()
            .setSelectedCellAndDirection(startCell.row, startCell.col, fallbackClue.direction);
        }
      }
    },
    [cells, clues]
  );

  /**
   * Navigate to the start or end of the current word
   */
  const navigateToWordBoundary = useCallback(
    (toStart: boolean) => {
      const currentState = useGameStore.getState();
      const currentSelectedCell = currentState.selectedCell;
      const currentDirection = currentState.selectedDirection;

      if (!currentSelectedCell) return;

      const boundary = toStart
        ? findWordStart(cells, currentSelectedCell.row, currentSelectedCell.col, currentDirection)
        : findWordEnd(cells, currentSelectedCell.row, currentSelectedCell.col, currentDirection);

      onCellSelect(boundary.row, boundary.col);
    },
    [cells, onCellSelect]
  );

  // Arrow key navigation - respects current direction
  // If arrow matches direction: move in that direction
  // If arrow is perpendicular: change orientation without moving
  useHotkeys(
    'arrowup',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'down') {
        // Move up (backward in down direction)
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, -1, 0);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      } else {
        // Change to down direction
        onDirectionToggle();
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, onDirectionToggle, enabled]
  );

  useHotkeys(
    'arrowdown',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'down') {
        // Move down (forward in down direction)
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 1, 0);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      } else {
        // Change to down direction
        onDirectionToggle();
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, onDirectionToggle, enabled]
  );

  useHotkeys(
    'arrowleft',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'across') {
        // Move left (backward in across direction)
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 0, -1);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      } else {
        // Change to across direction
        onDirectionToggle();
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, onDirectionToggle, enabled]
  );

  useHotkeys(
    'arrowright',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'across') {
        // Move right (forward in across direction)
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 0, 1);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      } else {
        // Change to across direction
        onDirectionToggle();
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, onDirectionToggle, enabled]
  );

  // Shift+Arrow keys for perpendicular movement without changing direction
  useHotkeys(
    'shift+arrowup,shift+arrowdown',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'across') {
        // Move perpendicular (up/down)
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, delta, 0);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  useHotkeys(
    'shift+arrowleft,shift+arrowright',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const currentState = useGameStore.getState();
      const currentDirection = currentState.selectedDirection;

      if (currentDirection === 'down') {
        // Move perpendicular (left/right)
        const delta = e.key === 'ArrowLeft' ? -1 : 1;
        const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 0, delta);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
      }
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  // [ and ] for perpendicular movement
  useHotkeys(
    '[',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      movePerpendicular(false);
    },
    { enabled, preventDefault: true },
    [movePerpendicular, enabled, selectedCell]
  );

  useHotkeys(
    ']',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      movePerpendicular(true);
    },
    { enabled, preventDefault: true },
    [movePerpendicular, enabled, selectedCell]
  );

  // Space for direction toggle
  useHotkeys(
    'space',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      onDirectionToggle();
    },
    { enabled, preventDefault: true },
    [onDirectionToggle, enabled]
  );

  // Tab/Shift+Tab for clue navigation
  useHotkeys(
    'tab',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      navigateToUnfilledClue(true);
    },
    { enabled, preventDefault: true },
    [navigateToUnfilledClue, enabled]
  );

  useHotkeys(
    'shift+tab',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      navigateToUnfilledClue(false);
    },
    { enabled, preventDefault: true },
    [navigateToUnfilledClue, enabled]
  );

  // Home/End for word boundaries
  useHotkeys(
    'home',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      navigateToWordBoundary(true);
    },
    { enabled, preventDefault: true },
    [navigateToWordBoundary, enabled, selectedCell]
  );

  useHotkeys(
    'end',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      navigateToWordBoundary(false);
    },
    { enabled, preventDefault: true },
    [navigateToWordBoundary, enabled, selectedCell]
  );

  // Period (.) for pencil mode toggle
  useHotkeys(
    '.',
    (e) => {
      if (!enabled || !onTogglePencil) return;
      e.preventDefault();
      onTogglePencil();
    },
    { enabled: enabled && !!onTogglePencil, preventDefault: true },
    [onTogglePencil, enabled]
  );

  // Alt+S/W/P for check square/word/puzzle
  useHotkeys(
    'alt+s',
    (e) => {
      if (!enabled || !onCheck) return;
      e.preventDefault();
      onCheck('cell');
    },
    { enabled: enabled && !!onCheck, preventDefault: true },
    [onCheck, enabled]
  );

  useHotkeys(
    'alt+w',
    (e) => {
      if (!enabled || !onCheck) return;
      e.preventDefault();
      onCheck('word');
    },
    { enabled: enabled && !!onCheck, preventDefault: true },
    [onCheck, enabled]
  );

  useHotkeys(
    'alt+p',
    (e) => {
      if (!enabled || !onCheck) return;
      e.preventDefault();
      onCheck('puzzle');
    },
    { enabled: enabled && !!onCheck, preventDefault: true },
    [onCheck, enabled]
  );

  // Alt+Shift+S/W/P for reveal square/word/puzzle
  useHotkeys(
    'alt+shift+s',
    (e) => {
      if (!enabled || !onReveal) return;
      e.preventDefault();
      onReveal('cell');
    },
    { enabled: enabled && !!onReveal, preventDefault: true },
    [onReveal, enabled]
  );

  useHotkeys(
    'alt+shift+w',
    (e) => {
      if (!enabled || !onReveal) return;
      e.preventDefault();
      onReveal('word');
    },
    { enabled: enabled && !!onReveal, preventDefault: true },
    [onReveal, enabled]
  );

  useHotkeys(
    'alt+shift+p',
    (e) => {
      if (!enabled || !onReveal) return;
      e.preventDefault();
      onReveal('puzzle');
    },
    { enabled: enabled && !!onReveal, preventDefault: true },
    [onReveal, enabled]
  );

  /**
   * Handle keyboard events (for letter input, backspace, and other keys)
   * This handles keys that need to work with the input element
   * NY Times style: typing moves forward, backspace clears current or moves back
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      if (!enabled) return;

      // Letter input - value is already set by GridCell's handleKeyDown
      // Just move to next cell in current direction
      if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
        requestAnimationFrame(() => {
          moveInDirection(true);
        });
        return;
      }

      // Backspace/Delete handling - NY Times style
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();

        const currentState = useGameStore.getState();
        const currentSelectedCell = currentState.selectedCell;
        const currentDirection = currentState.selectedDirection;

        const cellRow = currentSelectedCell?.row ?? row;
        const cellCol = currentSelectedCell?.col ?? col;
        const currentCell = cells[cellRow]?.[cellCol];

        // If cell has value, clear it but stay in place
        if (currentCell?.value) {
          onCellUpdate(cellRow, cellCol, '');
        } else {
          // If cell is empty, move backward and clear that cell
          const delta = -1;
          const rowDelta = currentDirection === 'down' ? delta : 0;
          const colDelta = currentDirection === 'across' ? delta : 0;
          const prevCell = findNextCell(cells, cellRow, cellCol, rowDelta, colDelta);

          if (prevCell) {
            onCellSelect(prevCell.row, prevCell.col);
            const prevCellData = cells[prevCell.row]?.[prevCell.col];
            if (prevCellData?.value) {
              onCellUpdate(prevCell.row, prevCell.col, '');
            }
          }
        }
      }
    },
    [enabled, cells, onCellUpdate, onCellSelect, moveInDirection]
  );

  return { handleKeyDown };
};
