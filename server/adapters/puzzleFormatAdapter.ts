/**
 * Puzzle Format Adapter
 * Handles conversion between different puzzle formats (old format and iPuz)
 */

import type {PuzzleJson} from '@crosswithfriends/shared/types';

import {logger} from '../utils/logger.js';

/**
 * Converts old puzzle format (with 'grid' and 'info') to ipuz format
 * This ensures all puzzles returned from the API are in the standard ipuz format
 */
export function convertOldFormatToIpuz(puzzle: PuzzleJson): PuzzleJson {
  // Check if this is old format
  const isOldFormat = 'grid' in puzzle && Array.isArray((puzzle as {grid?: unknown}).grid);

  // If already ipuz format, return as-is
  if (!isOldFormat) {
    return puzzle;
  }

  logger.debug('Converting old format puzzle to ipuz format');

  const oldPuzzle = puzzle as {
    grid?: string[][];
    info?: {title?: string; author?: string; copyright?: string; description?: string; type?: string};
    clues?: {down?: string[]; across?: string[]};
    circles?: number[];
    shades?: number[];
  };

  const grid = oldPuzzle.grid || [];
  if (grid.length === 0 || !grid[0] || grid[0].length === 0) {
    throw new Error('Old format puzzle has empty grid');
  }

  const height = grid.length;
  const width = grid[0].length;
  const info = oldPuzzle.info || {};

  // Convert grid to solution format (same structure for old format)
  const solution = grid.map((row) => row.map((cell) => cell));

  // Generate puzzle grid with cell numbers
  // We need to determine which cells are starts of words to assign numbers
  let cellNumber = 1;
  const puzzleGrid: (
    | number
    | string
    | {cell: number; style: {shapebg?: string; fillbg?: string}}
    | null
  )[][] = [];
  const circles = oldPuzzle.circles || [];
  const shades = oldPuzzle.shades || [];

  for (let r = 0; r < height; r++) {
    const row: (number | string | {cell: number; style: {shapebg?: string; fillbg?: string}} | null)[] = [];
    const solutionRow = solution[r];
    if (!solutionRow) {
      continue;
    }
    for (let c = 0; c < width; c++) {
      const cell = solutionRow[c];
      const isBlack = cell === '.' || cell === null || cell === '#';

      if (isBlack) {
        row.push('#');
      } else {
        // Determine if this cell starts a word
        const prevRow = r > 0 ? solution[r - 1] : undefined;
        const nextRow = r < height - 1 ? solution[r + 1] : undefined;
        const startsAcross = c === 0 || solutionRow[c - 1] === '.' || solutionRow[c - 1] === '#';
        const startsDown = r === 0 || prevRow?.[c] === '.' || prevRow?.[c] === '#';
        const hasAcrossWord =
          startsAcross && c < width - 1 && solutionRow[c + 1] !== '.' && solutionRow[c + 1] !== '#';
        const hasDownWord = startsDown && r < height - 1 && nextRow?.[c] !== '.' && nextRow?.[c] !== '#';

        const cellIdx = r * width + c;
        const hasCircle = circles.includes(cellIdx);
        const hasShade = shades.includes(cellIdx);

        if (hasAcrossWord || hasDownWord) {
          // Cell starts a word, gets a number
          if (hasCircle || hasShade) {
            const style: {shapebg?: string; fillbg?: string} = {};
            if (hasCircle) style.shapebg = 'circle';
            if (hasShade) style.fillbg = 'gray';
            row.push({cell: cellNumber, style});
          } else {
            row.push(cellNumber);
          }
          cellNumber += 1;
        } else {
          // Cell doesn't start a word
          if (hasCircle || hasShade) {
            const style: {shapebg?: string; fillbg?: string} = {};
            if (hasCircle) style.shapebg = 'circle';
            if (hasShade) style.fillbg = 'gray';
            row.push({cell: 0, style});
          } else {
            row.push('0');
          }
        }
      }
    }
    puzzleGrid.push(row);
  }

  // Convert clues from old array formats to ipuz v2 object format
  // Two old formats exist:
  // 1. Pair format: ['', '1', 'Clue text', '4', 'Clue text'] - consecutive pairs of (number, clue)
  // 2. Sparse format: [null, 'Clue 1', null, 'Clue 3'] - index IS the clue number
  const oldAcross = oldPuzzle.clues?.across || [];
  const oldDown = oldPuzzle.clues?.down || [];

  // Helper to check if a value is numeric
  const isNumeric = (value: string): boolean => /^\d+$/.test(value);

  // Helper to convert clue array based on detected format
  const convertClueArray = (arr: string[]): Array<{number: string; clue: string}> => {
    const result: Array<{number: string; clue: string}> = [];

    // Detect format: if array contains numeric strings, it's pair format
    const isPairFormat = arr.some((item) => typeof item === 'string' && isNumeric(item));

    if (isPairFormat) {
      // Pair format: ['', '1', 'Clue', '4', 'Clue']
      for (let i = 1; i < arr.length; i += 2) {
        const number = arr[i];
        const clue = arr[i + 1];
        if (number && clue) {
          result.push({number, clue});
        }
      }
    } else {
      // Sparse format: [null, 'Clue 1', null, 'Clue 3']
      for (let i = 1; i < arr.length; i++) {
        const clue = arr[i];
        if (clue && clue !== null) {
          result.push({number: i.toString(), clue});
        }
      }
    }

    return result;
  };

  const acrossClues = convertClueArray(oldAcross);
  const downClues = convertClueArray(oldDown);

  // Create ipuz format puzzle
  const ipuzPuzzle: PuzzleJson = {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: {width, height},
    title: info.title || '',
    author: info.author || '',
    copyright: info.copyright || '',
    notes: info.description || '',
    solution,
    puzzle: puzzleGrid,
    clues: {
      Across: acrossClues,
      Down: downClues,
    },
  };

  return ipuzPuzzle;
}

/**
 * Converts v1 array format clues to v2 object format
 * v1: [["1", "clue text"], ...]
 * v2: [{number: "1", clue: "clue text"}, ...]
 *
 * Also detects and fixes swapped clue fields (where number contains clue text and vice versa)
 */
export function convertCluesToV2(clues: {
  Across?: Array<[string, string] | {number: string; clue: string}>;
  Down?: Array<[string, string] | {number: string; clue: string}>;
  across?: Array<[string, string] | {number: string; clue: string}>;
  down?: Array<[string, string] | {number: string; clue: string}>;
}): {Across: Array<{number: string; clue: string}>; Down: Array<{number: string; clue: string}>} {
  const isNumeric = (str: string): boolean => {
    return /^\d+$/.test(str.trim());
  };

  const convertClueArray = (
    clueArray: Array<[string, string] | {number: string; clue: string}> | undefined
  ): Array<{number: string; clue: string}> => {
    if (!clueArray) {
      logger.warn('convertClueArray: clueArray is undefined or null');
      return [];
    }
    if (!Array.isArray(clueArray)) {
      logger.warn(
        {type: typeof clueArray, value: clueArray as unknown},
        'convertClueArray: clueArray is not an array'
      );
      return [];
    }
    if (clueArray.length === 0) {
      logger.warn('convertClueArray: clueArray is empty');
      return [];
    }

    logger.debug({clueArrayLength: clueArray.length, firstClue: clueArray[0]}, 'Converting clue array');

    const result: Array<{number: string; clue: string}> = [];
    for (let index = 0; index < clueArray.length; index++) {
      const clue = clueArray[index];
      try {
        if (Array.isArray(clue) && clue.length >= 2) {
          // v1 format: ["1", "clue text"]
          result.push({number: clue[0], clue: clue[1]});
        } else if (clue && typeof clue === 'object' && 'number' in clue && 'clue' in clue) {
          // v2 format: {number: "1", clue: "clue text"}
          const clueObj = clue as {number: string; clue: string};

          // Detect if fields are swapped: number should be numeric, clue should not be
          const numberIsNumeric = isNumeric(clueObj.number);
          const clueIsNumeric = isNumeric(clueObj.clue);

          // If number is not numeric but clue is, they're swapped
          if (!numberIsNumeric && clueIsNumeric) {
            logger.warn({original: clueObj}, 'Detected swapped clue fields, fixing:');
            result.push({number: clueObj.clue, clue: clueObj.number});
          } else if (!numberIsNumeric && !clueIsNumeric) {
            // If both are non-numeric, the data is corrupted
            // Use index + 1 as fallback (clues are typically ordered)
            logger.warn(
              {clueObj, index},
              `Clue at index ${index} has non-numeric number field, using index-based fallback:`
            );
            result.push({number: String(index + 1), clue: clueObj.clue || clueObj.number});
          } else {
            result.push(clueObj);
          }
        } else {
          logger.warn(
            {clue: clue as unknown, type: typeof clue, index},
            `Invalid clue format at index ${index}:`
          );
          // Skip invalid clues instead of throwing
        }
      } catch (error) {
        logger.error({error, index, clue}, 'Error converting clue at index');
        // Continue processing other clues
      }
    }

    logger.debug({inputLength: clueArray.length, outputLength: result.length}, 'Clue conversion complete');
    return result;
  };

  // Handle both capitalized and lowercase keys
  // Prefer capitalized if both exist, otherwise use whichever is available
  const acrossClues = clues.Across || clues.across;
  const downClues = clues.Down || clues.down;

  const result = {
    Across: convertClueArray(acrossClues),
    Down: convertClueArray(downClues),
  };

  // Remove any empty lowercase arrays that might exist (legacy format artifacts)
  // We only use capitalized Across/Down in ipuz v2 format
  return result;
}
