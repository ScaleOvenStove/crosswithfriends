import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import * as uuid from 'uuid';

import {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {logger} from '../utils/logger.js';
import {
  hasClueArrays,
  normalizeClues,
  removeLowercaseClueKeys,
  extractMetadata,
  getPuzzleTypeFromDimensions,
  type CluesObject,
  type NormalizedClues,
} from '../utils/puzzleFormatUtils.js';
import {validatePuzzle} from '../validation/puzzleSchema.js';

import {pool} from './pool.js';

// ================ Read and Write methods used to interface with postgres ========== //

// Re-export adapter functions for backward compatibility
export {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';

export async function getPuzzle(pid: string): Promise<PuzzleJson> {
  const startTime = Date.now();
  const {rows} = await pool.query(
    `
      SELECT content
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

  // Always return ipuz format to clients
  const puzzle = convertOldFormatToIpuz(firstRow.content);

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
  // see https://github.com/brianc/node-postgres/wiki/FAQ#11-how-do-i-build-a-where-foo-in--query-to-find-rows-matching-an-array-of-values
  // for why this is okay.
  // we create the query this way as POSTGRES optimizer does not use the index for an ILIKE ALL cause, but will for multiple ands
  // note this is not vulnerable to SQL injection because this string is just dynamically constructing params of the form $#
  // which we fully control.
  //
  // IMPORTANT: Production and staging share the same database, so we must support both formats:
  // - Old format: content->'info'->>'title' and content->'info'->>'author' (legacy puzzles)
  // - New format (ipuz): content->>'title' and content->>'author' (new puzzles)
  //
  // For size, we determine from solution array length (Mini if <= 10 rows, Standard if > 10)
  // or from info.type if it exists (old format)
  const parameterizedTileAuthorFilter = parametersForTitleAuthorFilter
    .map(
      (_s, idx) =>
        `AND (
          (COALESCE(content ->> 'title', content -> 'info' ->> 'title', '') || ' ' ||
           COALESCE(content ->> 'author', content -> 'info' ->> 'author', '')) ILIKE $${idx + parameterOffset}
        )`
    )
    .join('\n');
  // Size filter: check solution array length (jsonb_array_length on first dimension)
  // Mini: <= 10 rows, Standard: > 10 rows
  // Handle both old format (content->'info'->>'type') and ipuz format (content->'solution')
  const sizeFilterCondition =
    sizeFilterArray.length > 0
      ? `AND (
      CASE
        WHEN content->'info'->>'type' IS NOT NULL THEN
          (content->'info'->>'type')
        WHEN jsonb_array_length(content->'solution') <= 10 THEN 'Mini Puzzle'
        ELSE 'Daily Puzzle'
      END = ANY($1)
    )`
      : '';
  const queryParams =
    sizeFilterArray.length > 0
      ? [sizeFilterArray, limit, offset, ...parametersForTitleAuthorFilter]
      : [limit, offset, ...parametersForTitleAuthorFilter];
  const {rows} = await pool.query(
    `
      SELECT pid, uploaded_at, content, times_solved
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
  const puzzles = rows.map(
    (row: {
      pid: string;
      uploaded_at: string;
      is_public: boolean;
      content: PuzzleJson;
      times_solved: string;
      // NOTE: numeric returns as string in pg-promise
      // See https://stackoverflow.com/questions/39168501/pg-promise-returns-integers-as-strings
    }) => ({
      ...row,
      times_solved: Number(row.times_solved),
    })
  );
  const ms = Date.now() - startTime;
  logger.debug(`listPuzzles (${JSON.stringify(filter)}, ${limit}, ${offset}) took ${ms}ms`);
  return puzzles;
}

// Puzzle validation is now handled by validatePuzzle from validation/puzzleSchema.ts
// Additional validation for solution array is done inline in addPuzzle function

export async function addPuzzle(puzzle: PuzzleJson, isPublic = false, pid?: string): Promise<string> {
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

  await pool.query(
    `
      INSERT INTO puzzles (pid, uploaded_at, is_public, content, pid_numeric)
      VALUES ($1, to_timestamp($2), $3, $4, $5)`,
    [puzzleId, uploaded_at / 1000, isPublic, normalizedPuzzle, pidNumeric]
  );
  return puzzleId;
}

async function isGidAlreadySolved(gid: string): Promise<boolean> {
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

export async function recordSolve(pid: string, gid: string, timeToSolve: number): Promise<void> {
  const solved_time = Date.now();

  // Clients may log a solve multiple times; skip logging after the first one goes through
  if (await isGidAlreadySolved(gid)) {
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
      UPDATE puzzles SET times_solved = times_solved + 1
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
  pid: string
): Promise<{title: string; author: string; copyright: string; description: string; type?: string}> {
  const puzzle = await getPuzzle(pid);

  // Use shared utility for metadata extraction
  const metadata = extractMetadata(puzzle);

  // Calculate type from solution dimensions if not present
  const type = metadata.type || getPuzzleTypeFromDimensions(puzzle.solution?.length || 0);

  return {
    title: metadata.title,
    author: metadata.author,
    copyright: metadata.copyright,
    description: metadata.description,
    type,
  };
}
