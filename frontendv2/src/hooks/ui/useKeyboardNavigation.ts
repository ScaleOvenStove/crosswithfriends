/**
 * Keyboard Navigation Hook
 * Uses react-hotkeys-hook for declarative keyboard shortcuts
 * Implements REQ-1.2.4: Grid navigation using arrow keys
 *
 * Handles:
 * - Arrow key navigation
 * - Backspace/Delete for clearing cells
 * - Letter input for moving to next cell
 * - Tab for changing direction
 * - Space for toggling direction
 */

import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { Cell } from '../../types';
import { useGameStore } from '@stores/gameStore';

interface UseKeyboardNavigationProps {
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null; // Still needed for arrow key handlers
  onCellSelect: (row: number, col: number) => void;
  onCellUpdate: (row: number, col: number, value: string) => void;
  onDirectionToggle: () => void;
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
 * Hook for managing keyboard navigation in the crossword grid
 * Returns handlers for keyboard events
 */
export const useKeyboardNavigation = ({
  cells,
  selectedCell,
  onCellSelect,
  onCellUpdate,
  onDirectionToggle,
  enabled = true,
}: UseKeyboardNavigationProps): NavigationHandlers => {
  /**
   * Move in the current selected direction (across or down)
   * Uses store state directly to avoid stale closures
   */
  const moveInDirection = useCallback(
    (forward: boolean = true) => {
      // Get current state from store to avoid stale closures
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

  // Arrow key navigation
  useHotkeys(
    'arrowup',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, -1, 0);
      if (nextCell) onCellSelect(nextCell.row, nextCell.col);
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  useHotkeys(
    'arrowdown',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 1, 0);
      if (nextCell) onCellSelect(nextCell.row, nextCell.col);
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  useHotkeys(
    'arrowleft',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 0, -1);
      if (nextCell) onCellSelect(nextCell.row, nextCell.col);
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  useHotkeys(
    'arrowright',
    (e) => {
      if (!enabled || !selectedCell) return;
      e.preventDefault();
      const nextCell = findNextCell(cells, selectedCell.row, selectedCell.col, 0, 1);
      if (nextCell) onCellSelect(nextCell.row, nextCell.col);
    },
    { enabled, preventDefault: true },
    [cells, selectedCell, onCellSelect, enabled]
  );

  // Tab and Space for direction toggle
  useHotkeys(
    'tab,space',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      onDirectionToggle();
    },
    { enabled, preventDefault: true },
    [onDirectionToggle, enabled]
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
      // Use a small delay to ensure the cell update state has propagated
      if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
        // Move to next cell after the current cell update is processed
        // Use requestAnimationFrame to ensure React has processed the state update
        requestAnimationFrame(() => {
          moveInDirection(true);
        });
        return;
      }

      // Backspace/Delete handling - NY Times style
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();

        // Get current state from store to avoid stale closures
        const currentState = useGameStore.getState();
        const currentSelectedCell = currentState.selectedCell;
        const currentDirection = currentState.selectedDirection;

        // Use selectedCell from store as source of truth, fallback to row/col from event
        const cellRow = currentSelectedCell?.row ?? row;
        const cellCol = currentSelectedCell?.col ?? col;
        const currentCell = cells[cellRow]?.[cellCol];

        // If cell has value, clear it but stay in place
        if (currentCell?.value) {
          onCellUpdate(cellRow, cellCol, '');
        } else {
          // If cell is empty, move backward and clear that cell
          // Calculate previous cell position before moving
          const delta = -1;
          const rowDelta = currentDirection === 'down' ? delta : 0;
          const colDelta = currentDirection === 'across' ? delta : 0;
          const prevCell = findNextCell(cells, cellRow, cellCol, rowDelta, colDelta);

          if (prevCell) {
            // Move to previous cell
            onCellSelect(prevCell.row, prevCell.col);
            // Clear the previous cell if it has a value
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
