/**
 * Clue Generator Utility
 * Auto-generates clue structure from crossword grid
 */

import type { Cell, Clue } from '@types/index';

interface ClueSlot {
  number: number;
  answer: string;
  direction: 'across' | 'down';
  row: number;
  col: number;
}

/**
 * Determine if a cell starts an across word
 */
const startsAcross = (cells: Cell[][], row: number, col: number): boolean => {
  const cell = cells[row]?.[col];
  if (!cell || cell.isBlack) return false;

  const isStartOfRow = col === 0;
  const prevIsBlack = col > 0 && cells[row][col - 1].isBlack;
  const nextExists = col < cells[row].length - 1;
  const nextIsNotBlack = nextExists && !cells[row][col + 1].isBlack;

  return (isStartOfRow || prevIsBlack) && nextIsNotBlack;
};

/**
 * Determine if a cell starts a down word
 */
const startsDown = (cells: Cell[][], row: number, col: number): boolean => {
  const cell = cells[row]?.[col];
  if (!cell || cell.isBlack) return false;

  const isStartOfCol = row === 0;
  const prevIsBlack = row > 0 && cells[row - 1][col].isBlack;
  const nextExists = row < cells.length - 1;
  const nextIsNotBlack = nextExists && !cells[row + 1][col].isBlack;

  return (isStartOfCol || prevIsBlack) && nextIsNotBlack;
};

/**
 * Get the answer for an across word starting at (row, col)
 */
const getAcrossAnswer = (cells: Cell[][], row: number, col: number): string => {
  let answer = '';
  let c = col;

  while (c < cells[row].length && !cells[row][c].isBlack) {
    answer += cells[row][c].value.toUpperCase() || '?';
    c++;
  }

  return answer;
};

/**
 * Get the answer for a down word starting at (row, col)
 */
const getDownAnswer = (cells: Cell[][], row: number, col: number): string => {
  let answer = '';
  let r = row;

  while (r < cells.length && !cells[r][col].isBlack) {
    answer += cells[r][col].value.toUpperCase() || '?';
    r++;
  }

  return answer;
};

/**
 * Generate clue slots from grid with proper numbering
 */
export const generateCluesFromGrid = (
  cells: Cell[][],
  existingClues?: { across: Clue[]; down: Clue[] }
): { across: Clue[]; down: Clue[] } => {
  const clueSlots: ClueSlot[] = [];
  let clueNumber = 1;

  // First pass: identify all clue starting positions and assign numbers
  for (let row = 0; row < cells.length; row++) {
    for (let col = 0; col < cells[row].length; col++) {
      const hasAcross = startsAcross(cells, row, col);
      const hasDown = startsDown(cells, row, col);

      if (hasAcross || hasDown) {
        if (hasAcross) {
          clueSlots.push({
            number: clueNumber,
            answer: getAcrossAnswer(cells, row, col),
            direction: 'across',
            row,
            col,
          });
        }

        if (hasDown) {
          clueSlots.push({
            number: clueNumber,
            answer: getDownAnswer(cells, row, col),
            direction: 'down',
            row,
            col,
          });
        }

        clueNumber++;
      }
    }
  }

  // Second pass: create clue objects, preserving existing clue text
  const across: Clue[] = [];
  const down: Clue[] = [];

  clueSlots.forEach((slot) => {
    // Find existing clue text if it exists
    const existingClue =
      existingClues?.[slot.direction].find((c) => c.number === slot.number)?.clue || '';

    const clue: Clue = {
      number: slot.number,
      clue: existingClue,
      answer: slot.answer,
      direction: slot.direction,
    };

    if (slot.direction === 'across') {
      across.push(clue);
    } else {
      down.push(clue);
    }
  });

  return { across, down };
};
