/**
 * Keyboard Navigation Hook
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
import type { Cell } from '@types/index';

interface UseKeyboardNavigationProps {
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  selectedDirection: 'across' | 'down';
  onCellSelect: (row: number, col: number) => void;
  onCellUpdate: (row: number, col: number, value: string) => void;
  onDirectionToggle: () => void;
}

interface NavigationHandlers {
  handleKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void;
}

/**
 * Hook for managing keyboard navigation in the crossword grid
 * Returns handlers for keyboard events
 */
export const useKeyboardNavigation = ({
  cells,
  selectedCell,
  selectedDirection,
  onCellSelect,
  onCellUpdate,
  onDirectionToggle,
}: UseKeyboardNavigationProps): NavigationHandlers => {
  /**
   * Find the next non-black cell in the given direction
   */
  const findNextCell = useCallback(
    (
      row: number,
      col: number,
      rowDelta: number,
      colDelta: number
    ): { row: number; col: number } | null => {
      let newRow = row + rowDelta;
      let newCol = col + colDelta;

      // Check bounds
      while (newRow >= 0 && newRow < cells.length && newCol >= 0 && newCol < cells[0].length) {
        // Skip black squares
        if (!cells[newRow][newCol].isBlack) {
          return { row: newRow, col: newCol };
        }
        newRow += rowDelta;
        newCol += colDelta;
      }

      return null;
    },
    [cells]
  );

  /**
   * Move in the current selected direction (across or down)
   * Uses selectedCell as the source of truth for current position
   */
  const moveInDirection = useCallback(
    (forward: boolean = true) => {
      if (!selectedCell) return;
      
      const delta = forward ? 1 : -1;
      const rowDelta = selectedDirection === 'down' ? delta : 0;
      const colDelta = selectedDirection === 'across' ? delta : 0;

      const nextCell = findNextCell(selectedCell.row, selectedCell.col, rowDelta, colDelta);
      if (nextCell) {
        onCellSelect(nextCell.row, nextCell.col);
      }
    },
    [selectedCell, selectedDirection, findNextCell, onCellSelect]
  );

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      // Arrow key navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextCell = findNextCell(row, col, -1, 0);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextCell = findNextCell(row, col, 1, 0);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextCell = findNextCell(row, col, 0, -1);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextCell = findNextCell(row, col, 0, 1);
        if (nextCell) onCellSelect(nextCell.row, nextCell.col);
        return;
      }

      // Tab to change direction
      if (e.key === 'Tab') {
        e.preventDefault();
        onDirectionToggle();
        return;
      }

      // Space to toggle direction
      if (e.key === ' ') {
        e.preventDefault();
        onDirectionToggle();
        return;
      }

      // Backspace or Delete to clear cell and move backward
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (!selectedCell) return;
        
        const currentCell = cells[selectedCell.row]?.[selectedCell.col];

        // If cell has value, clear it but stay in place
        if (currentCell?.value) {
          onCellUpdate(selectedCell.row, selectedCell.col, '');
        } else {
          // If cell is empty, move backward and clear that cell
          moveInDirection(false);
        }
        return;
      }

      // Letter input - the actual value update is handled by GridCell onChange
      // Just move to next cell after input
      if (e.key.length === 1 && /^[A-Za-z]$/.test(e.key)) {
        // Move to next cell after a short delay to allow onChange to process
        // Use selectedCell as source of truth to avoid coordinate mismatches
        setTimeout(() => {
          moveInDirection(true);
        }, 0);
        return;
      }
    },
    [cells, findNextCell, onCellSelect, onCellUpdate, onDirectionToggle, moveInDirection]
  );

  return { handleKeyDown };
};
