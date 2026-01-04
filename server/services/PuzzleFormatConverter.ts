/**
 * Puzzle Format Converter Service
 * Centralized logic for converting puzzles from various formats to game event format
 * Eliminates code duplication between GameRepository and model/game.ts
 */

import {convertIpuzClues} from '@crosswithfriends/shared/lib/puzzleUtils';
import type {PuzzleJson, CellData, IpuzCell} from '@crosswithfriends/shared/types';

import {makeGrid} from '../gameUtils.js';
import {logger} from '../utils/logger.js';
import {
  isOldFormat,
  isIpuzFormat,
  extractMetadata,
  getPuzzleTypeFromDimensions,
  type OldPuzzleFormat,
} from '../utils/puzzleFormatUtils.js';

export interface ConvertedPuzzleData {
  solution: string[][];
  title: string;
  author: string;
  copyright: string;
  description: string;
  acrossClues: string[];
  downClues: string[];
  circles: number[];
  shades: number[];
  grid: CellData[][];
  clues: {
    across: string[];
    down: string[];
  };
  type: string;
}

/**
 * Converts a puzzle from any format (old format or ipuz) to game event format
 * @param puzzle - Puzzle in any supported format
 * @param pid - Puzzle ID (for error messages)
 * @returns Converted puzzle data ready for game event creation
 */
export function convertPuzzleToGameFormat(puzzle: PuzzleJson, pid: string): ConvertedPuzzleData {
  logger.debug({pid}, 'Converting puzzle to game format');

  const oldFormat = isOldFormat(puzzle);
  const ipuzFormat = isIpuzFormat(puzzle);

  if (!oldFormat && !ipuzFormat) {
    logger.error(
      {
        pid,
        puzzleKeys: Object.keys(puzzle),
        hasGrid: 'grid' in puzzle,
        hasSolution: 'solution' in puzzle,
      },
      'Puzzle format not recognized'
    );
    throw new Error(
      `Puzzle ${pid} is in an unrecognized format. Expected either old format (with 'grid' field) or ipuz format (with 'solution' field).`
    );
  }

  // Extract metadata using shared utility
  const metadata = extractMetadata(puzzle);
  const {title, author, copyright, description} = metadata;

  // Get solution and clues based on format
  const {solution, acrossClues, downClues} = oldFormat
    ? extractFromOldFormat(puzzle as OldPuzzleFormat, pid)
    : extractFromIpuzFormat(puzzle);

  // Validate solution
  validateSolution(solution, pid, puzzle);

  // Extract circles and shades
  const {circles, shades} = oldFormat
    ? extractStylesFromOldFormat(puzzle as OldPuzzleFormat, solution)
    : extractStylesFromIpuzFormat(puzzle);

  // Build grid
  const gridObject = makeGrid(solution, false);
  const clues = gridObject.alignClues({across: acrossClues, down: downClues});
  const grid = gridObject.toArray();

  // Validate grid
  validateGrid(grid, pid);

  // Determine puzzle type from grid size
  const type = getPuzzleTypeFromDimensions(solution.length);

  return {
    solution,
    title,
    author,
    copyright,
    description,
    acrossClues,
    downClues,
    circles,
    shades,
    grid,
    clues,
    type,
  };
}

/**
 * Extracts solution and clues from old format puzzle
 */
function extractFromOldFormat(
  puzzle: OldPuzzleFormat,
  pid: string
): {solution: string[][]; acrossClues: string[]; downClues: string[]} {
  logger.debug({pid}, 'Converting old format puzzle');

  const grid = puzzle.grid || [];
  if (!grid || grid.length === 0) {
    throw new Error(`Puzzle ${pid} has an empty grid array`);
  }

  // Convert grid to solution (same structure for old format)
  const solution = grid.map((row) => row.map((cell) => cell));

  // Old format clues are already sparse arrays indexed by clue number
  const acrossClues = puzzle.clues?.across || [];
  const downClues = puzzle.clues?.down || [];

  return {solution, acrossClues, downClues};
}

/**
 * Extracts solution and clues from ipuz format puzzle
 */
function extractFromIpuzFormat(puzzle: PuzzleJson): {
  solution: string[][];
  acrossClues: string[];
  downClues: string[];
} {
  // Convert solution: null -> '.'
  const solution = (puzzle.solution || []).map((row) => row.map((cell) => (cell === null ? '.' : cell)));

  // Convert ipuz clues format to internal format
  const acrossClues = convertIpuzClues(puzzle.clues?.Across || []);
  const downClues = convertIpuzClues(puzzle.clues?.Down || []);

  return {solution, acrossClues, downClues};
}

/**
 * Validates that solution is not empty
 */
function validateSolution(solution: string[][], pid: string, puzzle: PuzzleJson): void {
  if (!solution || solution.length === 0) {
    logger.error(
      {pid, puzzleKeys: Object.keys(puzzle), solutionValue: puzzle.solution},
      'Puzzle has empty solution array'
    );
    throw new Error(
      `Puzzle ${pid} has an empty solution array. This puzzle may be corrupted or in an invalid format. Please re-upload the puzzle with a valid solution.`
    );
  }
  if (!solution[0] || solution[0].length === 0) {
    logger.error(
      {pid, solutionLength: solution.length, firstRowLength: solution[0]?.length},
      'Puzzle has solution with empty rows'
    );
    throw new Error(
      `Puzzle ${pid} has a solution with empty rows. This puzzle may be corrupted or in an invalid format. Please re-upload the puzzle with a valid solution.`
    );
  }
}

/**
 * Validates that grid is not empty
 */
function validateGrid(grid: CellData[][], pid: string): void {
  if (!grid || grid.length === 0) {
    throw new Error(`Puzzle ${pid} produced an empty grid after processing`);
  }
  if (!grid[0] || grid[0].length === 0) {
    throw new Error(`Puzzle ${pid} produced a grid with empty rows after processing`);
  }
}

/**
 * Extracts circles and shades from old format puzzle
 */
function extractStylesFromOldFormat(
  puzzle: OldPuzzleFormat,
  _solution: string[][]
): {circles: number[]; shades: number[]} {
  const circles: number[] = [...(puzzle.circles || [])];
  const shades: number[] = [...(puzzle.shades || [])];
  return {circles, shades};
}

/**
 * Extracts circles and shades from ipuz format puzzle grid
 */
function extractStylesFromIpuzFormat(puzzle: PuzzleJson): {circles: number[]; shades: number[]} {
  const circles: number[] = [];
  const shades: number[] = [];
  const puzzleGrid = puzzle.puzzle || [];
  const ncol = puzzle.solution?.[0]?.length || 0;

  puzzleGrid.forEach((row: (number | string | IpuzCell | null)[], rowIndex: number) => {
    row.forEach((cell: number | string | IpuzCell | null, cellIndex: number) => {
      if (cell && typeof cell === 'object' && 'cell' in cell) {
        const idx = rowIndex * ncol + cellIndex;
        if (cell.style?.shapebg === 'circle') {
          circles.push(idx);
        }
        if (cell.style?.fillbg) {
          shades.push(idx);
        }
      }
    });
  });

  return {circles, shades};
}
