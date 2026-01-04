/**
 * Puzzle Utilities
 * Functions to transform ipuz puzzle format into frontend grid format
 */

import type { Cell, Clue } from '../types';
import type { PuzzleJson, ClueFormat } from '@api/types';
import {
  validatePuzzleData,
  type PuzzleJson as ValidatedPuzzleJson,
} from '../schemas/puzzleSchemas';

/**
 * Grid cell value type - can be a string, number, null, or special marker
 * Used for puzzle grids which have various cell representations
 */
type GridCellValue = string | number | null | undefined | '.' | '#';

/**
 * Transform ipuz puzzle data into Cell[][] format for the Grid component
 * Based on the ipuz format: https://www.puzzazz.com/ipuz/v1 and v2
 *
 * All puzzles from the server are now in ipuz format (v2)
 */
export function transformPuzzleToGrid(puzzle: PuzzleJson | ValidatedPuzzleJson | unknown): {
  cells: Cell[][];
  solution: string[][];
  circles: Array<{ r: number; c: number }>;
  shades: Array<{ r: number; c: number }>;
} {
  // Validate puzzle data with Zod
  const validatedPuzzle = validatePuzzleData(puzzle);

  const solution = validatedPuzzle.solution;
  const puzzleGrid = validatedPuzzle.puzzle;
  const dimensions = validatedPuzzle.dimensions;
  const height = dimensions.height;
  const width = dimensions.width;

  if (!height || !width || height <= 0 || width <= 0) {
    throw new Error(`Invalid puzzle dimensions: ${width}x${height}`);
  }

  const circles: Array<{ r: number; c: number }> = [];
  const shades: Array<{ r: number; c: number }> = [];

  // Create cells grid
  const cells: Cell[][] = [];

  for (let r = 0; r < height; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < width; c++) {
      const solutionCell = solution[r]?.[c];
      const puzzleCell = puzzleGrid[r]?.[c];

      // Determine if cell is black (blocked)
      const isBlack = solutionCell === '.' || solutionCell === null || solutionCell === '#';

      // Get cell number from puzzle grid
      let number: number | undefined = undefined;
      if (puzzleCell !== null && puzzleCell !== undefined) {
        if (typeof puzzleCell === 'number' && puzzleCell > 0) {
          number = puzzleCell;
        } else if (typeof puzzleCell === 'string' && puzzleCell !== '#' && puzzleCell !== '0') {
          number = parseInt(puzzleCell, 10);
        } else if (typeof puzzleCell === 'object' && 'cell' in puzzleCell) {
          // Handle cell objects with style
          const cellNum = puzzleCell.cell;
          if (typeof cellNum === 'number') {
            number = cellNum;
          } else if (typeof cellNum === 'string') {
            number = parseInt(cellNum, 10);
          }

          // Extract style information
          if (puzzleCell.style?.shapebg === 'circle') {
            circles.push({ r, c });
          }
          if (puzzleCell.style?.fillbg) {
            shades.push({ r, c });
          }
        }
      }

      // Create the cell
      row.push({
        value: '',
        number,
        isBlack,
        isPencil: false,
        hasCircle: false, // Will be set below if this cell is in circles
      });
    }
    cells.push(row);
  }

  // Mark cells that have circles
  circles.forEach(({ r, c }) => {
    if (cells[r] && cells[r][c]) {
      cells[r][c].hasCircle = true;
    }
  });

  return { cells, solution, circles, shades };
}

/**
 * Auto-assign numbers to grid cells based on crossword rules
 * A cell gets a number if it's the start of an across or down word
 */
export function assignCellNumbers(cells: Cell[][]): Cell[][] {
  let currentNumber = 1;
  const height = cells.length;
  const width = cells[0]?.length || 0;

  const result = cells.map((row) => row.map((cell) => ({ ...cell })));

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = result[r][c];

      if (cell.isBlack) continue;

      // Check if this cell starts an across word
      const startsAcross =
        (c === 0 || result[r][c - 1].isBlack) && c < width - 1 && !result[r][c + 1].isBlack;

      // Check if this cell starts a down word
      const startsDown =
        (r === 0 || result[r - 1][c].isBlack) && r < height - 1 && !result[r + 1][c].isBlack;

      if (startsAcross || startsDown) {
        if (!cell.number) {
          cell.number = currentNumber++;
        }
      }
    }
  }

  return result;
}

/**
 * Extract clues from ipuz puzzle format
 * Converts the ClueFormat[] into our Clue[] type
 *
 * NOTE: Handles both old format (lowercase 'across'/'down') and new format (capitalized 'Across'/'Down')
 */
export function extractCluesFromPuzzle(puzzle: PuzzleJson | ValidatedPuzzleJson | unknown): {
  across: Clue[];
  down: Clue[];
} {
  if (!puzzle) {
    console.warn('[puzzleUtils] Puzzle data is missing');
    return { across: [], down: [] };
  }

  // Validate puzzle data with Zod
  const validatedPuzzle = validatePuzzleData(puzzle);
  const puzzleAny = puzzle as Record<string, unknown>;

  // Get clues object - prefer validated top-level clues, fall back to info.clues for old format
  const cluesObj = getCluesObject(validatedPuzzle, puzzleAny);
  if (!cluesObj) {
    console.warn('[puzzleUtils] Clues are missing');
    return { across: [], down: [] };
  }

  // Get solution and puzzle grid for answer extraction
  const solutionGrid =
    validatedPuzzle.solution || (puzzleAny['grid'] as (string | null)[][] | undefined);
  const puzzleGridData = validatedPuzzle.puzzle || (puzzleAny['grid'] as unknown);

  // Extract clues arrays (handle both capitalized and lowercase keys)
  const cluesObjAny = cluesObj as Record<string, unknown>;
  const acrossClues = (cluesObjAny['Across'] || cluesObjAny['across'] || []) as ClueFormat[];
  const downClues = (cluesObjAny['Down'] || cluesObjAny['down'] || []) as ClueFormat[];

  return {
    across: parseClueArray(acrossClues, 'across', solutionGrid, puzzleGridData),
    down: parseClueArray(downClues, 'down', solutionGrid, puzzleGridData),
  };
}

/**
 * Gets the clues object from either top-level clues or info.clues (old format)
 */
function getCluesObject(
  validatedPuzzle: ValidatedPuzzleJson,
  puzzleAny: Record<string, unknown>
): unknown {
  const hasTopLevelClues =
    validatedPuzzle.clues &&
    ((Array.isArray(validatedPuzzle.clues.Across) && validatedPuzzle.clues.Across.length > 0) ||
      (Array.isArray(validatedPuzzle.clues.Down) && validatedPuzzle.clues.Down.length > 0));

  console.debug('[puzzleUtils] getCluesObject check:', {
    hasClues: !!validatedPuzzle.clues,
    hasAcross: !!validatedPuzzle.clues?.Across,
    hasDown: !!validatedPuzzle.clues?.Down,
    acrossLength: Array.isArray(validatedPuzzle.clues?.Across)
      ? validatedPuzzle.clues.Across.length
      : 'not array',
    downLength: Array.isArray(validatedPuzzle.clues?.Down)
      ? validatedPuzzle.clues.Down.length
      : 'not array',
    hasTopLevelClues,
  });

  if (hasTopLevelClues) {
    return validatedPuzzle.clues;
  }

  // Fall back to info.clues for old format
  const infoClues = (puzzleAny['info'] as { clues?: unknown })?.clues;
  console.debug('[puzzleUtils] Falling back to info.clues:', { hasInfoClues: !!infoClues });
  return infoClues;
}

/**
 * Parses a clue array into Clue objects
 */
function parseClueArray(
  clueArray: ClueFormat[],
  direction: 'across' | 'down',
  solutionGrid: (string | null)[][] | undefined,
  puzzleGridData: unknown
): Clue[] {
  if (!Array.isArray(clueArray) || clueArray.length === 0) {
    return [];
  }

  return clueArray.map((clue, index) => {
    const parsed = parseClue(clue, direction, solutionGrid, puzzleGridData);
    // Use index-based fallback if clue number is invalid
    if (isNaN(parsed.number)) {
      return { ...parsed, number: index + 1 };
    }
    return parsed;
  });
}

/**
 * Parses a single clue entry
 */
function parseClue(
  clue: ClueFormat,
  direction: 'across' | 'down',
  solutionGrid: (string | null)[][] | undefined,
  puzzleGridData: unknown
): Clue {
  let number: string;
  let text: string;

  if (Array.isArray(clue)) {
    [number, text] = clue;
  } else {
    number = clue.number;
    text = clue.clue;

    // Detect and fix swapped fields: number should be numeric, clue should not be
    if (!isNumeric(number) && isNumeric(text)) {
      [number, text] = [text, number];
    }
  }

  const clueNumber = parseInt(number, 10);
  const answer = solutionGrid
    ? extractAnswerFromSolution(
        solutionGrid,
        puzzleGridData as Array<Array<GridCellValue>>,
        clueNumber,
        direction
      )
    : '';

  return {
    number: clueNumber,
    clue: text,
    answer,
    direction,
  };
}

/**
 * Checks if a string is numeric
 */
function isNumeric(str: string): boolean {
  return /^\d+$/.test(String(str).trim());
}

/**
 * Calculate cell numbers for a grid (used for old format puzzles)
 */
function calculateCellNumbers(grid: Array<Array<GridCellValue>>): Map<string, number> {
  const cellNumbers = new Map<string, number>();
  let currentNumber = 1;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let r = 0; r < height; r++) {
    const row = grid[r];
    if (!row) continue;

    for (let c = 0; c < width; c++) {
      const cell = row[c];
      const isBlack = cell === '.' || cell === null || cell === '#';

      if (isBlack) continue;

      // Check if this cell starts an across word
      const startsAcross =
        (c === 0 || row[c - 1] === '.' || row[c - 1] === null) &&
        c < width - 1 &&
        row[c + 1] !== '.' &&
        row[c + 1] !== null;

      // Check if this cell starts a down word
      const startsDown =
        (r === 0 || grid[r - 1]?.[c] === '.' || grid[r - 1]?.[c] === null) &&
        r < height - 1 &&
        grid[r + 1]?.[c] !== '.' &&
        grid[r + 1]?.[c] !== null;

      if (startsAcross || startsDown) {
        cellNumbers.set(`${r},${c}`, currentNumber);
        currentNumber++;
      }
    }
  }

  return cellNumbers;
}

/**
 * Extract the answer for a specific clue from the solution grid
 */
function extractAnswerFromSolution(
  solution: Array<Array<string | null>>,
  puzzleGrid: Array<Array<GridCellValue>>,
  clueNumber: number,
  direction: 'across' | 'down'
): string {
  if (!solution || !puzzleGrid || solution.length === 0 || puzzleGrid.length === 0) {
    return '';
  }

  // Calculate cell numbers (for old format puzzles that don't have them)
  const cellNumbers = calculateCellNumbers(solution);

  // Find the starting position for this clue number
  const startPos = findClueStartPosition(cellNumbers, puzzleGrid, clueNumber);
  if (!startPos) {
    return '';
  }

  const { row: startRow, col: startCol } = startPos;

  // Extract the answer based on direction
  let answer = '';
  if (direction === 'across') {
    let col = startCol;
    while (col < (solution[startRow]?.length || 0) && !isBlackCell(solution[startRow]?.[col])) {
      answer += solution[startRow][col];
      col++;
    }
  } else {
    let row = startRow;
    while (row < solution.length && !isBlackCell(solution[row]?.[startCol])) {
      answer += solution[row][startCol];
      row++;
    }
  }

  return answer;
}

/**
 * Finds the starting position for a clue number
 */
function findClueStartPosition(
  cellNumbers: Map<string, number>,
  puzzleGrid: Array<Array<GridCellValue>>,
  clueNumber: number
): { row: number; col: number } | null {
  // First try calculated cell numbers
  for (const [pos, num] of cellNumbers.entries()) {
    if (num === clueNumber) {
      const [r, c] = pos.split(',').map(Number);
      return { row: r, col: c };
    }
  }

  // Fallback: try puzzle grid (new format)
  for (let r = 0; r < puzzleGrid.length; r++) {
    for (let c = 0; c < puzzleGrid[r].length; c++) {
      const cell = puzzleGrid[r][c];
      const cellNumber = extractCellNumber(cell);
      if (cellNumber === clueNumber) {
        return { row: r, col: c };
      }
    }
  }

  return null;
}

/**
 * Extracts the cell number from a puzzle grid cell
 */
function extractCellNumber(cell: GridCellValue): number | undefined {
  if (typeof cell === 'number') {
    return cell;
  }
  if (cell && typeof cell === 'object' && 'cell' in cell) {
    const cellNum = (cell as { cell: number | string }).cell;
    return typeof cellNum === 'number' ? cellNum : undefined;
  }
  return undefined;
}

/**
 * Checks if a cell value represents a black cell
 */
function isBlackCell(cell: string | null | undefined): boolean {
  return cell === null || cell === '.' || cell === '#';
}
