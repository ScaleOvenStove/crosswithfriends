/**
 * Puzzle Format Adapter
 * Handles conversion between different puzzle formats (old format and iPuz)
 */

import type {PuzzleJson} from '@crosswithfriends/shared/types';

import {logger} from '../utils/logger.js';
import {
  isOldFormat,
  extractMetadata,
  normalizeClues,
  type OldPuzzleFormat,
  type CluesObject,
  type NormalizedClues,
} from '../utils/puzzleFormatUtils.js';

/**
 * Converts old puzzle format (with 'grid' and 'info') to ipuz format
 * This ensures all puzzles returned from the API are in the standard ipuz format
 */
export function convertOldFormatToIpuz(puzzle: PuzzleJson): PuzzleJson {
  // If already ipuz format, return as-is
  if (!isOldFormat(puzzle)) {
    return puzzle;
  }

  logger.debug('Converting old format puzzle to ipuz format');

  const oldPuzzle = puzzle as OldPuzzleFormat;
  const grid = oldPuzzle.grid || [];
  if (grid.length === 0 || !grid[0] || grid[0].length === 0) {
    throw new Error('Old format puzzle has empty grid');
  }

  const height = grid.length;
  const width = grid[0].length;
  const metadata = extractMetadata(puzzle);

  // Convert grid to solution format (same structure for old format)
  const solution = grid.map((row) => row.map((cell) => cell));

  // Generate puzzle grid with cell numbers
  const puzzleGrid = generatePuzzleGrid(solution, oldPuzzle.circles || [], oldPuzzle.shades || []);

  // Convert clues from old array formats to ipuz v2 object format
  const acrossClues = convertOldClueArray(oldPuzzle.clues?.across || []);
  const downClues = convertOldClueArray(oldPuzzle.clues?.down || []);

  // Create ipuz format puzzle
  const ipuzPuzzle: PuzzleJson = {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    dimensions: {width, height},
    title: metadata.title,
    author: metadata.author,
    copyright: metadata.copyright,
    notes: metadata.description,
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
 * Generates a puzzle grid with cell numbers from a solution grid
 */
function generatePuzzleGrid(
  solution: string[][],
  circles: number[],
  shades: number[]
): (number | string | {cell: number; style: {shapebg?: string; fillbg?: string}} | null)[][] {
  const height = solution.length;
  const width = solution[0]?.length || 0;
  let cellNumber = 1;
  const puzzleGrid: (
    | number
    | string
    | {cell: number; style: {shapebg?: string; fillbg?: string}}
    | null
  )[][] = [];

  for (let r = 0; r < height; r++) {
    const row: (number | string | {cell: number; style: {shapebg?: string; fillbg?: string}} | null)[] = [];
    const solutionRow = solution[r];
    if (!solutionRow) continue;

    for (let c = 0; c < width; c++) {
      const cell = solutionRow[c];
      const isBlackCell = cell === '.' || cell === null || cell === '#';

      if (isBlackCell) {
        row.push('#');
        continue;
      }

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
        row.push(createPuzzleCell(cellNumber, hasCircle, hasShade));
        cellNumber += 1;
      } else {
        // Cell doesn't start a word
        row.push(createPuzzleCell(0, hasCircle, hasShade));
      }
    }
    puzzleGrid.push(row);
  }

  return puzzleGrid;
}

/**
 * Creates a puzzle cell with optional style
 */
function createPuzzleCell(
  number: number,
  hasCircle: boolean,
  hasShade: boolean
): number | string | {cell: number; style: {shapebg?: string; fillbg?: string}} {
  if (hasCircle || hasShade) {
    const style: {shapebg?: string; fillbg?: string} = {};
    if (hasCircle) style.shapebg = 'circle';
    if (hasShade) style.fillbg = 'gray';
    return {cell: number, style};
  }
  return number === 0 ? '0' : number;
}

/**
 * Converts old format clue arrays to ipuz v2 object format
 * Two old formats exist:
 * 1. Pair format: ['', '1', 'Clue text', '4', 'Clue text'] - consecutive pairs of (number, clue)
 * 2. Sparse format: [null, 'Clue 1', null, 'Clue 3'] - index IS the clue number
 */
function convertOldClueArray(arr: string[]): Array<{number: string; clue: string}> {
  const result: Array<{number: string; clue: string}> = [];

  // Helper to check if a value is numeric
  const isNumeric = (value: string): boolean => /^\d+$/.test(value);

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
}

/**
 * Converts v1 array format clues to v2 object format
 * v1: [["1", "clue text"], ...]
 * v2: [{number: "1", clue: "clue text"}, ...]
 *
 * Also detects and fixes swapped clue fields (where number contains clue text and vice versa)
 * This is a thin wrapper around normalizeClues for backward compatibility.
 */
export function convertCluesToV2(clues: CluesObject): NormalizedClues {
  return normalizeClues(clues);
}
