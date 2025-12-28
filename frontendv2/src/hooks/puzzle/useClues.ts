/**
 * Clues Hook - Manages clue data and interactions
 * Implements REQ-1.4: Clue Display
 *
 * Responsibilities:
 * - Provide clue data for across and down
 * - Track which clues are completed
 * - Sync with current cell selection
 */

import { useMemo } from 'react';
import type { Clue, Cell } from '@types/index';

interface UseCluesProps {
  clues: {
    across: Clue[];
    down: Clue[];
  };
  cells: Cell[][];
  selectedCell: { row: number; col: number } | null;
  selectedDirection: 'across' | 'down';
  isAutoCheckMode?: boolean;
}

interface UseCluesResult {
  acrossClues: Clue[];
  downClues: Clue[];
  currentClue: Clue | null;
  completedClues: Set<string>;
  getClueByNumber: (number: number, direction: 'across' | 'down') => Clue | undefined;
  isClueCompleted: (clue: Clue) => boolean;
}

/**
 * Hook for managing crossword clues
 */
export const useClues = ({
  clues,
  cells,
  selectedCell,
  selectedDirection,
  isAutoCheckMode = false,
}: UseCluesProps): UseCluesResult => {
  /**
   * Get the current clue based on selected cell and direction
   */
  const currentClue = useMemo(() => {
    if (!selectedCell || !cells[selectedCell.row]) {
      return null;
    }

    const { row, col } = selectedCell;
    const _cell = cells[row][col];

    // Find the clue number for this cell
    const clueNumber = findClueNumberForCell(cells, row, col, selectedDirection);

    if (!clueNumber) {
      return null;
    }

    // Find the clue in the appropriate list
    const clueList = selectedDirection === 'across' ? clues.across : clues.down;
    return clueList.find((c) => c.number === clueNumber) || null;
  }, [cells, selectedCell, selectedDirection, clues]);

  /**
   * Calculate which clues are completed
   * Only calculates when auto-check mode is enabled
   */
  const completedClues = useMemo(() => {
    const completed = new Set<string>();

    // Only show completions when auto-check is enabled
    if (!isAutoCheckMode) {
      return completed;
    }

    // Check across clues
    clues.across.forEach((clue) => {
      if (isClueFilledCorrectly(cells, clue, 'across')) {
        completed.add(`across-${clue.number}`);
      }
    });

    // Check down clues
    clues.down.forEach((clue) => {
      if (isClueFilledCorrectly(cells, clue, 'down')) {
        completed.add(`down-${clue.number}`);
      }
    });

    return completed;
  }, [cells, clues, isAutoCheckMode]);

  /**
   * Get a clue by number and direction
   */
  const getClueByNumber = (number: number, direction: 'across' | 'down') => {
    const clueList = direction === 'across' ? clues.across : clues.down;
    return clueList.find((c) => c.number === number);
  };

  /**
   * Check if a clue is completed
   */
  const isClueCompleted = (clue: Clue) => {
    return completedClues.has(`${clue.direction}-${clue.number}`);
  };

  return {
    acrossClues: clues.across,
    downClues: clues.down,
    currentClue,
    completedClues,
    getClueByNumber,
    isClueCompleted,
  };
};

/**
 * Helper: Find the clue number for a given cell and direction
 */
function findClueNumberForCell(
  cells: Cell[][],
  row: number,
  col: number,
  direction: 'across' | 'down'
): number | null {
  if (direction === 'across') {
    // Move left to find the start of the word
    let startCol = col;
    while (startCol > 0 && !cells[row][startCol - 1].isBlack) {
      startCol--;
    }
    return cells[row][startCol].number || null;
  } else {
    // Move up to find the start of the word
    let startRow = row;
    while (startRow > 0 && !cells[startRow - 1][col].isBlack) {
      startRow--;
    }
    return cells[startRow][col].number || null;
  }
}

/**
 * Helper: Check if a clue is filled correctly
 * Verifies that all cells are filled with the correct answer
 */
function isClueFilledCorrectly(cells: Cell[][], clue: Clue, direction: 'across' | 'down'): boolean {
  // Find the starting position of this clue
  const start = findClueStartPosition(cells, clue.number);
  if (!start) return false;

  const { row, col } = start;
  const answerLength = clue.answer.length;

  // Check if all cells are filled with the correct values
  for (let i = 0; i < answerLength; i++) {
    const checkRow = direction === 'down' ? row + i : row;
    const checkCol = direction === 'across' ? col + i : col;

    if (!cells[checkRow] || !cells[checkRow][checkCol]) {
      return false;
    }

    const cell = cells[checkRow][checkCol];

    // Cell must have a non-pencil value
    if (!cell.value || cell.isPencil) {
      return false;
    }

    // Check if the cell value matches the correct answer (case-insensitive)
    const correctLetter = clue.answer[i];
    if (!correctLetter) {
      return false;
    }

    const cellLetter = cell.value.toUpperCase();

    if (cellLetter !== correctLetter.toUpperCase()) {
      return false;
    }
  }

  return true;
}

/**
 * Helper: Find the starting position of a clue by its number
 */
function findClueStartPosition(
  cells: Cell[][],
  clueNumber: number
): { row: number; col: number } | null {
  for (let row = 0; row < cells.length; row++) {
    for (let col = 0; col < cells[row].length; col++) {
      if (cells[row][col].number === clueNumber) {
        return { row, col };
      }
    }
  }
  return null;
}
