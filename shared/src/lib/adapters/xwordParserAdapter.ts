/**
 * Adapter to convert xword-parser Puzzle format to internal GameJson format
 *
 * This adapter bridges the gap between the standardized xword-parser format
 * and the internal game format used by the application.
 */

import type {Puzzle, Cell, Clue} from '@xwordly/xword-parser';
import type {
  GameJson,
  CellData,
  CluesJson,
  InfoJson,
  CellIndex,
  PuzzleJson,
  IpuzCell,
} from '../../shared/types';
import {toCellIndex} from '../../shared/types';

/**
 * Converts xword-parser Puzzle format to internal GameJson format
 *
 * @param puzzle - The puzzle in xword-parser format
 * @returns The puzzle in internal GameJson format
 * @throws Error if puzzle is invalid (empty grid, missing clues, etc.)
 */
export function puzzleToGameJson(puzzle: Puzzle): GameJson {
  // Validate puzzle
  if (!puzzle.grid || !puzzle.grid.cells || puzzle.grid.cells.length === 0) {
    throw new Error('Puzzle has an empty grid');
  }
  if (puzzle.grid.width <= 0 || puzzle.grid.height <= 0) {
    throw new Error(`Invalid puzzle dimensions: ${puzzle.grid.width}x${puzzle.grid.height}`);
  }
  if (!puzzle.clues || (!puzzle.clues.across?.length && !puzzle.clues.down?.length)) {
    throw new Error('Puzzle has no clues');
  }

  // Convert grid
  const grid: CellData[][] = puzzle.grid.cells.map((row) => row.map((cell) => convertCell(cell)));

  // Convert solution
  const solution: string[][] = puzzle.grid.cells.map((row) =>
    row.map((cell) => (cell.isBlack ? '.' : cell.solution || ''))
  );

  // Convert clues
  const clues: CluesJson = {
    across: convertClues(puzzle.clues.across),
    down: convertClues(puzzle.clues.down),
  };

  // Extract circles and shades
  const circles: CellIndex[] = [];
  const shades: CellIndex[] = [];
  const ncol = puzzle.grid.width;

  // Extract circles from puzzle cells
  puzzle.grid.cells.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.isCircled) {
        circles.push(toCellIndex(rowIndex, colIndex, ncol));
      }
      // Note: xword-parser doesn't have a direct "shade" property
      // Shades are extracted from PuzzleJson format in puzzleJsonToPuzzle
      // For now, shades will be empty when converting from xword-parser Puzzle
      // They should be preserved when converting PuzzleJson -> Puzzle -> GameJson
    });
  });

  // Build info object
  const info: InfoJson = {
    title: puzzle.title || '',
    author: puzzle.author || '',
    copyright: puzzle.copyright || '',
    description: puzzle.notes || '',
    type: puzzle.grid.height > 10 ? 'Daily Puzzle' : 'Mini Puzzle',
  };

  return {
    info,
    grid,
    solution,
    clues,
    circles: circles.length > 0 ? circles : undefined,
    shades: shades.length > 0 ? shades : undefined,
  };
}

/**
 * Converts a single Cell from xword-parser format to CellData
 */
function convertCell(cell: Cell): CellData {
  return {
    value: cell.solution || '',
    black: cell.isBlack,
    number: cell.number,
    // Note: xword-parser doesn't track these game-specific fields
    // They will be set during gameplay
    revealed: false,
    bad: false,
    good: false,
    pencil: false,
  };
}

/**
 * Converts clues from xword-parser format to internal format
 * xword-parser uses Clue[] with {number, text}
 * Internal format uses string[] indexed by clue number
 */
function convertClues(clues: Clue[]): string[] {
  const result: string[] = [];
  for (const clue of clues) {
    if (clue.number !== undefined) {
      result[clue.number] = clue.text;
    }
  }
  return result;
}

/**
 * Converts PuzzleJson (ipuz format) to xword-parser Puzzle format
 * This allows us to use xword-parser adapters with puzzles from the database
 *
 * @param puzzleJson - The puzzle in ipuz format
 * @returns The puzzle in xword-parser format
 * @throws Error if puzzleJson is invalid
 */
export function puzzleJsonToPuzzle(puzzleJson: PuzzleJson): Puzzle {
  // Validate input
  if (!puzzleJson.dimensions || !puzzleJson.dimensions.width || !puzzleJson.dimensions.height) {
    throw new Error('PuzzleJson missing dimensions');
  }
  if (!puzzleJson.solution || puzzleJson.solution.length === 0) {
    throw new Error('PuzzleJson missing solution');
  }
  if (!puzzleJson.puzzle || puzzleJson.puzzle.length === 0) {
    throw new Error('PuzzleJson missing puzzle grid');
  }
  if (!puzzleJson.clues || (!puzzleJson.clues.Across?.length && !puzzleJson.clues.Down?.length)) {
    throw new Error('PuzzleJson missing clues');
  }

  const height = puzzleJson.dimensions.height;
  const width = puzzleJson.dimensions.width;

  // Convert solution and puzzle grid to cells
  const cells: Cell[][] = [];
  for (let r = 0; r < height; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < width; c++) {
      const solutionCell = puzzleJson.solution[r]?.[c];
      const puzzleCell = puzzleJson.puzzle[r]?.[c];

      const isBlack = solutionCell === null || solutionCell === '#';
      const solution = isBlack ? undefined : solutionCell || '';

      // Extract clue number and circle from puzzle grid
      let number: number | undefined;
      let isCircled = false;

      if (typeof puzzleCell === 'number') {
        // Number clue (0 means no clue number, just empty cell)
        number = puzzleCell === 0 ? undefined : puzzleCell;
      } else if (typeof puzzleCell === 'string' && puzzleCell !== '#') {
        // String clue number ("0" means no clue number, just empty cell)
        const parsed = parseInt(puzzleCell, 10);
        if (!isNaN(parsed) && parsed !== 0) {
          number = parsed;
        }
      } else if (puzzleCell && typeof puzzleCell === 'object' && 'cell' in puzzleCell) {
        const cellValue =
          typeof puzzleCell.cell === 'number'
            ? puzzleCell.cell
            : typeof puzzleCell.cell === 'string'
              ? parseInt(puzzleCell.cell, 10)
              : undefined;
        // 0 means no clue number
        number = cellValue === 0 ? undefined : cellValue;
        isCircled = puzzleCell.style?.shapebg === 'circle';
        // Note: xword-parser doesn't support shades directly
        // Shades are extracted separately in puzzleStore
      }

      row.push({
        solution,
        isBlack,
        number,
        isCircled,
      });
    }
    cells.push(row);
  }

  // Convert clues
  const convertCluesArray = (clueArray: Array<[string, string] | {number: string; clue: string}>) => {
    const result: Clue[] = [];
    for (const item of clueArray) {
      if (Array.isArray(item) && item.length >= 2) {
        const num = parseInt(item[0], 10);
        if (!isNaN(num)) {
          result.push({number: num, text: item[1]});
        }
      } else if (item && typeof item === 'object' && 'number' in item && 'clue' in item) {
        const num = parseInt(item.number, 10);
        if (!isNaN(num)) {
          result.push({number: num, text: item.clue});
        }
      }
    }
    return result;
  };

  const across = convertCluesArray(puzzleJson.clues.Across || []);
  const down = convertCluesArray(puzzleJson.clues.Down || []);

  return {
    title: puzzleJson.title,
    author: puzzleJson.author,
    copyright: puzzleJson.copyright,
    notes: puzzleJson.notes,
    grid: {
      width,
      height,
      cells,
    },
    clues: {
      across,
      down,
    },
  };
}

/**
 * Converts xword-parser Puzzle to PuzzleJson (ipuz format for storage)
 * This is used when storing puzzles in the database
 *
 * @param puzzle - The puzzle in xword-parser format
 * @returns The puzzle in ipuz format
 * @throws Error if puzzle is invalid
 */
export function puzzleToPuzzleJson(puzzle: Puzzle): PuzzleJson {
  // Validate puzzle
  if (!puzzle.grid || !puzzle.grid.cells || puzzle.grid.cells.length === 0) {
    throw new Error('Puzzle has an empty grid');
  }
  if (puzzle.grid.width <= 0 || puzzle.grid.height <= 0) {
    throw new Error(`Invalid puzzle dimensions: ${puzzle.grid.width}x${puzzle.grid.height}`);
  }
  if (!puzzle.clues || (!puzzle.clues.across?.length && !puzzle.clues.down?.length)) {
    throw new Error('Puzzle has no clues');
  }

  // Build solution array (null for black squares)
  const solution: (string | null)[][] = puzzle.grid.cells.map((row) =>
    row.map((cell) => (cell.isBlack ? null : cell.solution || ''))
  );

  // Build puzzle grid with clue numbers
  const puzzleGrid: (number | string | IpuzCell | null)[][] = [];

  puzzle.grid.cells.forEach((row) => {
    const puzzleRow: (number | string | IpuzCell | null)[] = [];
    row.forEach((cell) => {
      if (cell.isBlack) {
        puzzleRow.push('#');
      } else {
        const hasCircle = cell.isCircled;
        if (hasCircle && cell.number !== undefined) {
          // Cell with style (circle)
          puzzleRow.push({
            cell: cell.number,
            style: {
              shapebg: 'circle',
            },
          });
        } else if (cell.number !== undefined && cell.number !== 0) {
          // Just a clue number (0 means no clue)
          puzzleRow.push(cell.number);
        } else {
          // Empty cell (no clue number) - use "0" for ipuz v2 compatibility
          puzzleRow.push('0');
        }
      }
    });
    puzzleGrid.push(puzzleRow);
  });

  // Convert clues to ipuz format
  const acrossCluesArray: Array<[string, string]> = puzzle.clues.across
    .filter((clue) => clue.number !== undefined)
    .map((clue) => [String(clue.number!), clue.text]);

  const downCluesArray: Array<[string, string]> = puzzle.clues.down
    .filter((clue) => clue.number !== undefined)
    .map((clue) => [String(clue.number!), clue.text]);

  return {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: {
      width: puzzle.grid.width,
      height: puzzle.grid.height,
    },
    title: puzzle.title || '',
    author: puzzle.author || '',
    copyright: puzzle.copyright,
    notes: puzzle.notes,
    solution,
    puzzle: puzzleGrid,
    clues: {
      Across: acrossCluesArray,
      Down: downCluesArray,
    },
  };
}
