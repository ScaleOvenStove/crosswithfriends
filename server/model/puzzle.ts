/**
 * Legacy Puzzle Model
 *
 */

import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import * as uuid from 'uuid';

import {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {logger} from '../utils/logger.js';
import {
  hasClueArrays,
  normalizeClues,
  removeLowercaseClueKeys,
  extractNormalizedData,
  type CluesObject,
  type NormalizedClues,
} from '../utils/puzzleFormatUtils.js';
import {validatePuzzle} from '../validation/puzzleSchema.js';

import type {DatabasePool} from './pool.js';

// ================ Read and Write methods used to interface with postgres ========== //

// Re-export adapter functions for backward compatibility
export {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';

export async function getPuzzle(pool: DatabasePool, pid: string): Promise<PuzzleJson> {
  const startTime = Date.now();
  // Query uses normalized columns where available, falls back to puzzle_data for grid/clues
  const {rows} = await pool.query(
    `
      SELECT 
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_type,
        puzzle_data
      FROM puzzles
      WHERE pid = $1
    `,
    [pid]
  );
  const ms = Date.now() - startTime;
  logger.debug(`getPuzzle (${pid}) took ${ms}ms`);
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error(`Puzzle ${pid} not found`);
  }

  // Reconstruct full PuzzleJson from normalized columns + puzzle_data
  const puzzleData = firstRow.puzzle_data || {};
  const convertedPuzzle = convertOldFormatToIpuz(puzzleData);
  // Check if puzzle was converted from old format (has 'grid' field)
  const puzzleDataWithGrid = puzzleData as {grid?: unknown};
  const wasOldFormat = 'grid' in puzzleDataWithGrid && Array.isArray(puzzleDataWithGrid.grid);
  const puzzle: PuzzleJson = {
    ...convertedPuzzle,
    // Overlay normalized columns (these are authoritative after migration)
    title: firstRow.title || puzzleData.title || '',
    author: firstRow.author || puzzleData.author || '',
    copyright: firstRow.copyright || puzzleData.copyright || '',
    notes: firstRow.notes || puzzleData.notes || '',
    // If converted from old format, use v2 version from conversion; otherwise use stored version
    version: wasOldFormat
      ? convertedPuzzle.version
      : firstRow.version || puzzleData.version || 'http://ipuz.org/v1',
    kind: firstRow.kind || puzzleData.kind || ['http://ipuz.org/crossword#1'],
    dimensions: {
      width: firstRow.width || puzzleData.dimensions?.width || 0,
      height: firstRow.height || puzzleData.dimensions?.height || 0,
    },
  };

  // Normalize clues to v2 format
  normalizePuzzleCluesWithLogging(puzzle, pid);

  return puzzle;
}

/**
 * Normalizes puzzle clues to v2 format with appropriate logging
 */
function normalizePuzzleCluesWithLogging(puzzle: PuzzleJson, pid: string): void {
  if (!puzzle.clues) {
    logger.warn({pid}, 'Puzzle has no clues object');
    return;
  }

  const cluesInput = puzzle.clues as CluesObject;
  if (!hasClueArrays(cluesInput)) {
    logger.warn(
      {pid, cluesKeys: Object.keys(puzzle.clues)},
      'Puzzle has clues object but all clue arrays are empty'
    );
    return;
  }

  // Normalize clues to v2 format
  puzzle.clues = normalizeClues(cluesInput);
  removeLowercaseClueKeys(puzzle.clues as CluesObject);
}

const mapSizeFilterForDB = (sizeFilter: ListPuzzleRequestFilters['sizeFilter']): string[] => {
  const ret = [];
  if (sizeFilter.Mini) {
    ret.push('Mini Puzzle');
  }
  if (sizeFilter.Standard) {
    ret.push('Daily Puzzle');
  }
  return ret;
};

export async function listPuzzles(
  pool: DatabasePool,
  filter: ListPuzzleRequestFilters,
  limit: number,
  offset: number
): Promise<
  {
    pid: string;
    content: PuzzleJson;
    times_solved: number;
  }[]
> {
  const startTime = Date.now();
  // Filter out empty strings from search terms
  const parametersForTitleAuthorFilter = filter.nameOrTitleFilter
    .split(/\s/)
    .filter((s) => s.length > 0)
    .map((s) => `%${s}%`);
  const sizeFilterArray = mapSizeFilterForDB(filter.sizeFilter);
  // Parameter offset depends on whether size filter is present:
  // - With size filter: $1=sizeFilter, $2=limit, $3=offset, $4+=titleAuthorFilter
  // - Without size filter: $1=limit, $2=offset, $3+=titleAuthorFilter
  const parameterOffset = sizeFilterArray.length > 0 ? 4 : 3;

  // Use normalized columns for filtering (much faster than JSONB extraction)
  const parameterizedTileAuthorFilter = parametersForTitleAuthorFilter
    .map((_s, idx) => `AND (title || ' ' || author) ILIKE $${idx + parameterOffset}`)
    .join('\n');

  // Use normalized puzzle_type column for size filtering (much faster)
  const sizeFilterCondition = sizeFilterArray.length > 0 ? `AND puzzle_type = ANY($1)` : '';

  const queryParams =
    sizeFilterArray.length > 0
      ? [sizeFilterArray, limit, offset, ...parametersForTitleAuthorFilter]
      : [limit, offset, ...parametersForTitleAuthorFilter];

  // Query using normalized columns
  const {rows} = await pool.query(
    `
      SELECT 
        pid,
        uploaded_at,
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_type,
        puzzle_data,
        times_solved
      FROM puzzles
      WHERE is_public = true
      ${sizeFilterCondition}
      ${parameterizedTileAuthorFilter}
      ORDER BY pid_numeric DESC 
      LIMIT $${sizeFilterArray.length > 0 ? '2' : '1'}
      OFFSET $${sizeFilterArray.length > 0 ? '3' : '2'}
    `,
    queryParams
  );

  // Reconstruct PuzzleJson from normalized columns + puzzle_data
  const puzzles = rows.map(
    (row: {
      pid: string;
      uploaded_at: string;
      title: string;
      author: string;
      copyright: string;
      notes: string;
      version: string;
      kind: string[];
      width: number;
      height: number;
      puzzle_type: string;
      puzzle_data: PuzzleJson;
      times_solved: string;
    }) => ({
      pid: row.pid,
      uploaded_at: row.uploaded_at,
      content: {
        ...row.puzzle_data,
        title: row.title,
        author: row.author,
        copyright: row.copyright,
        notes: row.notes,
        version: row.version,
        kind: row.kind,
        dimensions: {width: row.width, height: row.height},
      } as PuzzleJson,
      times_solved: Number(row.times_solved),
    })
  );
  const ms = Date.now() - startTime;
  logger.debug(`listPuzzles (${JSON.stringify(filter)}, ${limit}, ${offset}) took ${ms}ms`);
  return puzzles;
}

// Puzzle validation is now handled by validatePuzzle from validation/puzzleSchema.ts
// Additional validation for solution array is done inline in addPuzzle function

export async function addPuzzle(
  pool: DatabasePool,
  puzzle: PuzzleJson,
  isPublic = false,
  pid?: string
): Promise<string> {
  let puzzleId = pid;
  if (!puzzleId) {
    puzzleId = uuid.v4().substring(0, 8);
  }
  validatePuzzle(puzzle);

  // Normalize clues to v2 format before saving
  // This ensures consistent storage format regardless of input format
  const normalizedPuzzle = {...puzzle};
  if (normalizedPuzzle.clues) {
    try {
      const cluesInput = normalizedPuzzle.clues as CluesObject;
      const acrossCount =
        (Array.isArray(cluesInput.Across) ? cluesInput.Across.length : 0) ||
        (Array.isArray(cluesInput.across) ? cluesInput.across.length : 0);
      const downCount =
        (Array.isArray(cluesInput.Down) ? cluesInput.Down.length : 0) ||
        (Array.isArray(cluesInput.down) ? cluesInput.down.length : 0);

      logger.debug(
        {
          pid: puzzleId,
          hasAcross: !!cluesInput.Across || !!cluesInput.across,
          hasDown: !!cluesInput.Down || !!cluesInput.down,
          acrossCount,
          downCount,
        },
        'Converting clues before save'
      );

      normalizedPuzzle.clues = normalizeClues(cluesInput);
      removeLowercaseClueKeys(normalizedPuzzle.clues as CluesObject);

      const normalizedClues = normalizedPuzzle.clues as NormalizedClues;
      logger.debug(
        {
          pid: puzzleId,
          acrossCount: normalizedClues.Across?.length || 0,
          downCount: normalizedClues.Down?.length || 0,
        },
        'Converted clues after save'
      );
    } catch (error) {
      logger.error({error}, 'Failed to convert clues');
      throw new Error(`Failed to convert clues: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    logger.warn({pid: puzzleId}, 'Puzzle has no clues object during save');
  }

  const uploaded_at = Date.now();

  // Only set pid_numeric if pid is numeric, otherwise NULL
  // Check if pid matches numeric pattern: digits optionally with decimal point
  const pidNumeric = /^([0-9]+[.]?[0-9]*|[.][0-9]+)$/.test(puzzleId) ? puzzleId : null;

  // Extract normalized data for dedicated columns
  const normalizedData = extractNormalizedData(normalizedPuzzle);

  // Insert with normalized columns + puzzle_data JSONB
  // Note: puzzle_type is a generated column computed from height, so it's not in the INSERT
  // The generated column will automatically compute puzzle_type based on height
  await pool.query(
    `
      INSERT INTO puzzles (
        pid,
        pid_numeric,
        uid,
        is_public,
        uploaded_at,
        updated_at,
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_data
      )
      VALUES ($1, $2, $3, $4, to_timestamp($5), to_timestamp($5), $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      puzzleId,
      pidNumeric,
      null, // uid - can be passed in later if needed
      isPublic,
      uploaded_at / 1000,
      normalizedData.title,
      normalizedData.author,
      normalizedData.copyright,
      normalizedData.notes,
      normalizedData.version,
      normalizedData.kind,
      normalizedData.width,
      normalizedData.height,
      normalizedPuzzle,
    ]
  );
  return puzzleId;
}

async function isGidAlreadySolved(pool: DatabasePool, gid: string): Promise<boolean> {
  // Note: This gate makes use of the assumption "one pid per gid";
  // The unique index on (pid, gid) is more strict than this
  const {rows} = await pool.query(
    `
    SELECT COUNT(*)
    FROM puzzle_solves
    WHERE gid=$1
  `,
    [gid]
  );
  const firstRow = rows[0];
  if (!firstRow) {
    return false;
  }
  return firstRow.count > 0;
}

export async function recordSolve(
  pool: DatabasePool,
  pid: string,
  gid: string,
  timeToSolve: number
): Promise<void> {
  const solved_time = Date.now();

  // Clients may log a solve multiple times; skip logging after the first one goes through
  if (await isGidAlreadySolved(pool, gid)) {
    return;
  }
  const client = await pool.connect();

  // The frontend clients are designed in a way that concurrent double logs are fairly common
  // we use a transaction here as it lets us only update if we are able to insert a solve (in case we double log a solve).

  try {
    await client.query('BEGIN');
    await client.query(
      `
      INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve)
      VALUES ($1, $2, to_timestamp($3), $4)
    `,
      [pid, gid, solved_time / 1000.0, timeToSolve]
    );
    await client.query(
      `
      UPDATE puzzles SET times_solved = times_solved + 1, updated_at = NOW()
      WHERE pid = $1
    `,
      [pid]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({err: error, pid, gid, solved_time, timeToSolve}, 'Failed to record puzzle solve');
  } finally {
    client.release();
  }
}

export async function getPuzzleInfo(
  pool: DatabasePool,
  pid: string
): Promise<{title: string; author: string; copyright: string; description: string; type?: string}> {
  // Use normalized columns directly (much faster than fetching full puzzle)
  const {rows} = await pool.query(
    `
      SELECT title, author, copyright, notes, puzzle_type
      FROM puzzles
      WHERE pid = $1
    `,
    [pid]
  );

  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error(`Puzzle ${pid} not found`);
  }

  return {
    title: firstRow.title || '',
    author: firstRow.author || '',
    copyright: firstRow.copyright || '',
    description: firstRow.notes || '',
    type: firstRow.puzzle_type,
  };
}
