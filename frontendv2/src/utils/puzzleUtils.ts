/**
 * Puzzle Utilities
 * Functions to transform ipuz puzzle format into frontend grid format
 */

import type { Cell, Clue } from '../types';
import type { PuzzleJson, ClueFormat } from '@api/types';

/**
 * Transform ipuz puzzle data into Cell[][] format for the Grid component
 * Based on the ipuz format: https://www.puzzazz.com/ipuz/v1 and v2
 *
 * All puzzles from the server are now in ipuz format (v2)
 */
export function transformPuzzleToGrid(puzzle: PuzzleJson | any): {
  cells: Cell[][];
  solution: string[][];
  circles: Array<{ r: number; c: number }>;
  shades: Array<{ r: number; c: number }>;
} {
  // Safety checks for puzzle data structure
  if (!puzzle) {
    throw new Error('Puzzle data is missing');
  }

  // Validate ipuz format fields
  const missing: string[] = [];
  if (!puzzle.solution) missing.push('solution');
  if (!puzzle.puzzle) missing.push('puzzle grid');
  if (!puzzle.dimensions) missing.push('dimensions');

  if (missing.length > 0) {
    console.error('[puzzleUtils] Incomplete puzzle data. Missing:', missing);
    console.error('[puzzleUtils] Received puzzle keys:', Object.keys(puzzle));
    throw new Error(
      `Puzzle data is incomplete - missing: ${missing.join(', ')}. This puzzle may be corrupted or still being processed.`
    );
  }

  const solution = puzzle.solution;
  const puzzleGrid = puzzle.puzzle;
  const dimensions = puzzle.dimensions;
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
export function extractCluesFromPuzzle(puzzle: PuzzleJson | any): {
  across: Clue[];
  down: Clue[];
} {
  // Safety checks for puzzle data structure
  if (!puzzle) {
    console.warn('[puzzleUtils] Puzzle data is missing');
    return { across: [], down: [] };
  }

  // Old format: clues are nested inside info.clues
  // New format: clues are at the top level
  // Check if puzzle.clues has actual across/down data
  const hasTopLevelClues =
    puzzle.clues &&
    (puzzle.clues.across || puzzle.clues.down || puzzle.clues.Across || puzzle.clues.Down);

  const cluesObj = hasTopLevelClues ? puzzle.clues : puzzle.info?.clues;

  if (!cluesObj) {
    console.warn('[puzzleUtils] Clues are missing in both puzzle.clues and puzzle.info.clues');
    console.warn('[puzzleUtils] puzzle.clues:', puzzle.clues);
    console.warn('[puzzleUtils] puzzle.info:', puzzle.info);
    return { across: [], down: [] };
  }

  // Log the clues object structure for debugging
  console.log('[puzzleUtils] Clues object structure:', {
    keys: Object.keys(cluesObj),
    hasAcross: 'Across' in cluesObj,
    hasacross: 'across' in cluesObj,
    hasDown: 'Down' in cluesObj,
    hasdown: 'down' in cluesObj,
    AcrossType: Array.isArray(cluesObj.Across),
    acrossType: Array.isArray(cluesObj.across),
    DownType: Array.isArray(cluesObj.Down),
    downType: Array.isArray(cluesObj.down),
  });

  // Determine solution/puzzle grid for old vs new format
  const solutionGrid = puzzle.solution || puzzle.grid;
  const puzzleGridData = puzzle.puzzle || puzzle.grid;

  const parseClue = (clue: ClueFormat, direction: 'across' | 'down'): Clue => {
    // Handle both tuple and object formats
    let number: string;
    let text: string;

    if (Array.isArray(clue)) {
      [number, text] = clue;
    } else {
      number = clue.number;
      text = clue.clue;

      // Detect and fix swapped fields: number should be numeric, clue should not be
      const numberIsNumeric = /^\d+$/.test(String(number).trim());
      const clueIsNumeric = /^\d+$/.test(String(text).trim());

      // If number is not numeric but clue is, they're swapped
      if (!numberIsNumeric && clueIsNumeric) {
        console.warn('[puzzleUtils] Detected swapped clue fields, fixing:', {
          original: { number, clue: text },
        });
        [number, text] = [text, number];
      }
    }

    const clueNumber = parseInt(number, 10);
    if (isNaN(clueNumber)) {
      console.warn('[puzzleUtils] Invalid clue number:', number, 'for clue:', text);
    }

    // Extract answer from solution grid
    const answer = extractAnswerFromSolution(solutionGrid, puzzleGridData, clueNumber, direction);

    return {
      number: clueNumber,
      clue: text,
      answer,
      direction,
    };
  };

  // Handle both capitalized (Across/Down) and lowercase (across/down) keys
  const acrossClues = cluesObj.Across || cluesObj.across || [];
  const downClues = cluesObj.Down || cluesObj.down || [];

  console.log('[puzzleUtils] Extracting clues:', {
    hasAcross: !!cluesObj.Across || !!cluesObj.across,
    hasDown: !!cluesObj.Down || !!cluesObj.down,
    acrossCount: acrossClues.length,
    downCount: downClues.length,
    cluesObjKeys: Object.keys(cluesObj),
  });

  // Parse clues with index-based fallback for clue numbers
  const parseCluesWithIndex = (clueArray: ClueFormat[], direction: 'across' | 'down'): Clue[] => {
    if (!Array.isArray(clueArray) || clueArray.length === 0) {
      console.warn(`[puzzleUtils] No ${direction} clues found or clues is not an array`);
      return [];
    }

    return clueArray.map((clue: ClueFormat, index: number) => {
      const parsed = parseClue(clue, direction);
      // If clue number is NaN, try to use index + 1 as fallback
      // (clues are typically ordered, so index 0 = clue 1, index 1 = clue 2, etc.)
      if (isNaN(parsed.number)) {
        console.warn(
          `[puzzleUtils] Using index-based fallback for ${direction} clue ${index}:`,
          clue
        );
        return {
          ...parsed,
          number: index + 1,
        };
      }
      return parsed;
    });
  };

  const result = {
    across: parseCluesWithIndex(acrossClues, 'across'),
    down: parseCluesWithIndex(downClues, 'down'),
  };

  console.log('[puzzleUtils] Extracted clues result:', {
    acrossCount: result.across.length,
    downCount: result.down.length,
  });

  return result;
}

/**
 * Calculate cell numbers for a grid (used for old format puzzles)
 */
function calculateCellNumbers(grid: Array<Array<any>>): Map<string, number> {
  const cellNumbers = new Map<string, number>();
  let currentNumber = 1;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r][c];
      const isBlack = cell === '.' || cell === null || cell === '#';

      if (isBlack) continue;

      // Check if this cell starts an across word
      const startsAcross =
        (c === 0 || grid[r][c - 1] === '.' || grid[r][c - 1] === null) &&
        c < width - 1 &&
        grid[r][c + 1] !== '.' &&
        grid[r][c + 1] !== null;

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
  puzzleGrid: Array<Array<any>>,
  clueNumber: number,
  direction: 'across' | 'down'
): string {
  // Safety checks
  if (!solution || !puzzleGrid || solution.length === 0 || puzzleGrid.length === 0) {
    console.warn('[puzzleUtils] Solution or puzzle grid is missing or empty');
    return '';
  }

  // Calculate cell numbers (for old format puzzles that don't have them)
  const cellNumbers = calculateCellNumbers(solution);

  // Find the starting position for this clue number
  let startRow = -1;
  let startCol = -1;

  // First try to find from calculated cell numbers
  for (const [pos, num] of cellNumbers.entries()) {
    if (num === clueNumber) {
      const [r, c] = pos.split(',').map(Number);
      startRow = r;
      startCol = c;
      break;
    }
  }

  // Fallback: try to extract from puzzleGrid directly (new format)
  if (startRow === -1) {
    for (let r = 0; r < puzzleGrid.length; r++) {
      for (let c = 0; c < puzzleGrid[r].length; c++) {
        const cell = puzzleGrid[r][c];
        let cellNumber: number | undefined;

        if (typeof cell === 'number') {
          cellNumber = cell;
        } else if (cell && typeof cell === 'object' && 'cell' in cell) {
          const cellNum = cell.cell;
          if (typeof cellNum === 'number') {
            cellNumber = cellNum;
          }
        }

        if (cellNumber === clueNumber) {
          startRow = r;
          startCol = c;
          break;
        }
      }
      if (startRow !== -1) break;
    }
  }

  if (startRow === -1 || startCol === -1) {
    return ''; // Could not find the clue number
  }

  // Extract the answer based on direction
  let answer = '';
  if (direction === 'across') {
    let col = startCol;
    while (
      col < solution[startRow]?.length &&
      solution[startRow]?.[col] !== null &&
      solution[startRow]?.[col] !== '.' &&
      solution[startRow]?.[col] !== '#'
    ) {
      answer += solution[startRow][col];
      col++;
    }
  } else {
    let row = startRow;
    while (
      row < solution.length &&
      solution[row]?.[startCol] !== null &&
      solution[row]?.[startCol] !== '.' &&
      solution[row]?.[startCol] !== '#'
    ) {
      answer += solution[row][startCol];
      row++;
    }
  }

  return answer;
}
