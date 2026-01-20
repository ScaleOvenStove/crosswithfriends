/**
 * Shared Puzzle Format Utilities
 * Centralized utilities for puzzle format detection, metadata extraction, and clue normalization.
 * Eliminates code duplication across server/adapters, server/model, and server/services.
 */

import type { PuzzleJson } from '@crosswithfriends/shared/types';

import { logger } from './logger.js';

/**
 * Represents the old puzzle format with 'grid' and 'info' fields
 */
export interface OldPuzzleFormat {
  grid?: string[][];
  info?: { title?: string; author?: string; copyright?: string; description?: string; type?: string };
  clues?: { down?: string[]; across?: string[] };
  circles?: number[];
  shades?: number[];
}

/**
 * Clue entry in v1 format (array) or v2 format (object)
 */
export type ClueEntry = [string, string] | { number: string; clue: string; cells?: unknown };

/**
 * Clues object with both capitalized and lowercase keys for compatibility
 */
export interface CluesObject {
  Across?: ClueEntry[];
  Down?: ClueEntry[];
  across?: ClueEntry[];
  down?: ClueEntry[];
}

/**
 * Normalized clues object with only capitalized keys and v2 format
 */
export interface NormalizedClues {
  Across: Array<{ number: string; clue: string; cells?: unknown }>;
  Down: Array<{ number: string; clue: string; cells?: unknown }>;
}

/**
 * Extracted metadata from a puzzle
 */
export interface PuzzleMetadata {
  title: string;
  author: string;
  copyright: string;
  description: string;
  type?: string;
}

/**
 * Full normalized puzzle data for database columns
 * Includes all fields needed for the normalized schema
 */
export interface NormalizedPuzzleData {
  title: string;
  author: string;
  copyright: string;
  notes: string;
  version: string;
  kind: string[];
  width: number;
  height: number;
  puzzleType: 'Mini Puzzle' | 'Daily Puzzle';
}

/**
 * Checks if a puzzle is in the old format (has 'grid' field)
 */
export function isOldFormat(puzzle: PuzzleJson | OldPuzzleFormat): boolean {
  return 'grid' in puzzle && Array.isArray((puzzle as OldPuzzleFormat).grid);
}

/**
 * Checks if a puzzle is in ipuz format (has 'solution' field)
 */
export function isIpuzFormat(puzzle: PuzzleJson | OldPuzzleFormat): boolean {
  return 'solution' in puzzle && Array.isArray((puzzle as PuzzleJson).solution);
}

/**
 * Extracts metadata from a puzzle in either format
 */
export function extractMetadata(puzzle: PuzzleJson | OldPuzzleFormat): PuzzleMetadata {
  if (isOldFormat(puzzle)) {
    const oldPuzzle = puzzle as OldPuzzleFormat;
    const info = oldPuzzle.info || {};
    return {
      title: info.title || '',
      author: info.author || '',
      copyright: info.copyright || '',
      description: info.description || '',
      type: info.type,
    };
  }

  // ipuz format
  const ipuzPuzzle = puzzle as PuzzleJson;
  return {
    title: ipuzPuzzle.title || '',
    author: ipuzPuzzle.author || '',
    copyright: ipuzPuzzle.copyright || '',
    description: ipuzPuzzle.notes || '',
    type: getPuzzleTypeFromDimensions(ipuzPuzzle.solution?.length || 0),
  };
}

/**
 * Determines puzzle type from grid row count
 * Mini puzzles are 10 rows or smaller, Daily puzzles are larger
 */
export function getPuzzleTypeFromDimensions(rowCount: number): 'Mini Puzzle' | 'Daily Puzzle' {
  return rowCount <= 10 ? 'Mini Puzzle' : 'Daily Puzzle';
}

/**
 * Checks if a string is numeric
 */
function isNumeric(str: string): boolean {
  return /^\d+$/.test(str.trim());
}

/**
 * Checks if clues object has any clue arrays with content
 */
export function hasClueArrays(clues: CluesObject | undefined): boolean {
  if (!clues) return false;
  return (
    (Array.isArray(clues.Across) && clues.Across.length > 0) ||
    (Array.isArray(clues.across) && clues.across.length > 0) ||
    (Array.isArray(clues.Down) && clues.Down.length > 0) ||
    (Array.isArray(clues.down) && clues.down.length > 0)
  );
}

/**
 * Checks if clues are already in v2 format (object format with number and clue properties)
 */
function isClueArrayV2Format(clueArray: ClueEntry[] | undefined): boolean {
  if (!clueArray || clueArray.length === 0) return false;
  const firstClue = clueArray[0];
  return (
    typeof firstClue === 'object' &&
    firstClue !== null &&
    !Array.isArray(firstClue) &&
    'number' in firstClue &&
    'clue' in firstClue
  );
}

/**
 * Converts a single clue entry to v2 format
 * Handles detection and fixing of swapped fields
 */
function convertClueEntryToV2(
  clue: ClueEntry,
  index: number
): { number: string; clue: string; cells?: unknown } | null {
  if (Array.isArray(clue) && clue.length >= 2) {
    // v1 format: ["1", "clue text"]
    return { number: clue[0], clue: clue[1] };
  }

  if (clue && typeof clue === 'object' && 'number' in clue && 'clue' in clue) {
    // v2 format: {number: "1", clue: "clue text", cells?: [...]}
    const clueObj = clue as { number: string; clue: string; cells?: unknown;[key: string]: unknown };

    const numberIsNumeric = isNumeric(clueObj.number);
    const clueIsNumeric = isNumeric(clueObj.clue);

    // If number is not numeric but clue is, they're swapped
    if (!numberIsNumeric && clueIsNumeric) {
      logger.warn({ original: clueObj }, 'Detected swapped clue fields, fixing');
      const { number: _num, clue: _clue, ...rest } = clueObj;
      return { number: clueObj.clue, clue: clueObj.number, ...rest };
    }

    // If both are non-numeric, use index as fallback
    if (!numberIsNumeric && !clueIsNumeric) {
      logger.warn({ clueObj, index }, `Clue at index ${index} has non-numeric number field, using fallback`);
      const { number: _num, clue: _clue, ...rest } = clueObj;
      return { number: String(index + 1), clue: clueObj.clue || clueObj.number, ...rest };
    }

    // Preserve all properties including cells
    return clueObj;
  }

  logger.warn({ clue, type: typeof clue, index }, `Invalid clue format at index ${index}`);
  return null;
}

/**
 * Converts a clue array to v2 format
 */
function convertClueArrayToV2(
  clueArray: ClueEntry[] | undefined
): Array<{ number: string; clue: string; cells?: unknown }> {
  if (!clueArray || !Array.isArray(clueArray) || clueArray.length === 0) {
    return [];
  }

  const result: Array<{ number: string; clue: string; cells?: unknown }> = [];
  for (let index = 0; index < clueArray.length; index++) {
    const clue: ClueEntry | undefined = clueArray[index];
    if (clue === undefined) continue;
    const converted = convertClueEntryToV2(clue, index);
    if (converted) {
      result.push(converted);
    }
  }
  return result;
}

/**
 * Converts v1 array format clues to v2 object format and normalizes keys
 * - v1: [["1", "clue text"], ...]
 * - v2: [{number: "1", clue: "clue text"}, ...]
 *
 * Handles:
 * - Both capitalized (Across/Down) and lowercase (across/down) keys
 * - Detection and fixing of swapped clue fields
 * - Idempotent: returns as-is if already in v2 format
 */
export function normalizeClues(clues: CluesObject | undefined): NormalizedClues {
  if (!clues) {
    return { Across: [], Down: [] };
  }

  // Get clue arrays, preferring capitalized keys IF they have content
  // This handles cases where file has empty "Across": [] but populated "across": [...]
  const hasAcross = Array.isArray(clues.Across) && clues.Across.length > 0;
  const hasLowerAcross = Array.isArray(clues.across) && clues.across.length > 0;
  const acrossClues = hasAcross ? clues.Across : (hasLowerAcross ? clues.across : (clues.Across || clues.across));

  const hasDown = Array.isArray(clues.Down) && clues.Down.length > 0;
  const hasLowerDown = Array.isArray(clues.down) && clues.down.length > 0;
  const downClues = hasDown ? clues.Down : (hasLowerDown ? clues.down : (clues.Down || clues.down));

  // If clues are already in v2 format, return them as-is (idempotent)
  // Check if BOTH arrays are in v2 format (or empty)
  // We need to check both because one might be v1 and the other v2
  const acrossIsV2 =
    !acrossClues ||
    (Array.isArray(acrossClues) && (acrossClues.length === 0 || isClueArrayV2Format(acrossClues)));
  const downIsV2 =
    !downClues || (Array.isArray(downClues) && (downClues.length === 0 || isClueArrayV2Format(downClues)));

  // Only return as-is if BOTH are in v2 format (or empty/missing)
  // If one is v1 format, we need to convert both
  if (acrossIsV2 && downIsV2) {
    logger.debug('Clues are already in v2 format, returning as-is');
    return {
      Across: (Array.isArray(acrossClues) ? acrossClues : []) as Array<{
        number: string;
        clue: string;
        cells?: unknown;
      }>,
      Down: (Array.isArray(downClues) ? downClues : []) as Array<{
        number: string;
        clue: string;
        cells?: unknown;
      }>,
    };
  }

  return {
    Across: convertClueArrayToV2(acrossClues),
    Down: convertClueArrayToV2(downClues),
  };
}

/**
 * Removes lowercase clue keys from a clues object (in-place mutation)
 * Used to clean up legacy format artifacts after normalization
 */
export function removeLowercaseClueKeys(clues: CluesObject): void {
  if ('across' in clues) {
    delete clues.across;
  }
  if ('down' in clues) {
    delete clues.down;
  }
}

/**
 * Normalizes clues on a puzzle object in-place
 * Converts to v2 format and removes lowercase keys
 */
export function normalizePuzzleClues(puzzle: PuzzleJson): void {
  if (!puzzle.clues) return;

  const normalizedClues = normalizeClues(puzzle.clues as CluesObject);
  puzzle.clues = normalizedClues;
}

/**
 * Extracts puzzle dimensions from either format
 * Returns {width, height} or defaults to {0, 0} if not determinable
 */
export function extractDimensions(puzzle: PuzzleJson | OldPuzzleFormat): { width: number; height: number } {
  // Try ipuz format first
  if ('dimensions' in puzzle && puzzle.dimensions) {
    const dims = puzzle.dimensions as { width?: number; height?: number };
    if (typeof dims.width === 'number' && typeof dims.height === 'number') {
      return { width: dims.width, height: dims.height };
    }
  }

  // Try to calculate from solution array (ipuz format)
  if ('solution' in puzzle && Array.isArray(puzzle.solution) && puzzle.solution.length > 0) {
    const height = puzzle.solution.length;
    const firstRow = puzzle.solution[0];
    const width = Array.isArray(firstRow) ? firstRow.length : 0;
    return { width, height };
  }

  // Try to calculate from puzzle grid (ipuz format)
  if ('puzzle' in puzzle && Array.isArray(puzzle.puzzle) && puzzle.puzzle.length > 0) {
    const height = puzzle.puzzle.length;
    const firstRow = puzzle.puzzle[0];
    const width = Array.isArray(firstRow) ? firstRow.length : 0;
    return { width, height };
  }

  // Try old format with grid
  if (isOldFormat(puzzle)) {
    const oldPuzzle = puzzle as OldPuzzleFormat;
    if (oldPuzzle.grid && oldPuzzle.grid.length > 0) {
      const height = oldPuzzle.grid.length;
      const firstRow = oldPuzzle.grid[0];
      const width = Array.isArray(firstRow) ? firstRow.length : 0;
      return { width, height };
    }
  }

  logger.warn('Could not determine puzzle dimensions');
  return { width: 0, height: 0 };
}

/**
 * Extracts the version string from a puzzle
 * Defaults to 'http://ipuz.org/v1' if not present
 */
export function extractVersion(puzzle: PuzzleJson | OldPuzzleFormat): string {
  if ('version' in puzzle && typeof puzzle.version === 'string') {
    return puzzle.version;
  }
  return 'http://ipuz.org/v1';
}

/**
 * Extracts the kind array from a puzzle
 * Defaults to ['http://ipuz.org/crossword#1'] if not present
 */
export function extractKind(puzzle: PuzzleJson | OldPuzzleFormat): string[] {
  if ('kind' in puzzle && Array.isArray(puzzle.kind)) {
    return puzzle.kind.map((k) => String(k));
  }
  return ['http://ipuz.org/crossword#1'];
}

/**
 * Extracts all normalized data needed for database columns
 * This is the main function to use when inserting/updating puzzles
 */
export function extractNormalizedData(puzzle: PuzzleJson | OldPuzzleFormat): NormalizedPuzzleData {
  const metadata = extractMetadata(puzzle);
  const dimensions = extractDimensions(puzzle);
  const version = extractVersion(puzzle);
  const kind = extractKind(puzzle);
  const puzzleType = getPuzzleTypeFromDimensions(dimensions.height);

  return {
    title: metadata.title || 'Untitled',
    author: metadata.author || 'Unknown',
    copyright: metadata.copyright || '',
    notes: metadata.description || '',
    version,
    kind,
    width: dimensions.width,
    height: dimensions.height,
    puzzleType,
  };
}
