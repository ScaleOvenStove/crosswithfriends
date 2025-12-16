import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import * as uuid from 'uuid';

import {convertCluesToV2, convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {logger} from '../utils/logger.js';
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

  // Convert any v1 array format clues to v2 object format
  if (puzzle.clues) {
    const cluesInput = puzzle.clues as {
      Across?: unknown[];
      across?: unknown[];
      Down?: unknown[];
      down?: unknown[];
    };

    const hasClues =
      (Array.isArray(cluesInput.Across) && cluesInput.Across.length > 0) ||
      (Array.isArray(cluesInput.across) && cluesInput.across.length > 0) ||
      (Array.isArray(cluesInput.Down) && cluesInput.Down.length > 0) ||
      (Array.isArray(cluesInput.down) && cluesInput.down.length > 0);

    if (hasClues) {
      let acrossCount = 0;
      if (Array.isArray(cluesInput.Across)) {
        acrossCount = cluesInput.Across.length;
      } else if (Array.isArray(cluesInput.across)) {
        acrossCount = cluesInput.across.length;
      }

      let downCount = 0;
      if (Array.isArray(cluesInput.Down)) {
        downCount = cluesInput.Down.length;
      } else if (Array.isArray(cluesInput.down)) {
        downCount = cluesInput.down.length;
      }

      logger.debug(
        {
          hasAcross: !!cluesInput.Across,
          hasacross: !!cluesInput.across,
          hasDown: !!cluesInput.Down,
          hasdown: !!cluesInput.down,
          acrossCount,
          downCount,
        },
        'Converting clues on retrieve'
      );

      puzzle.clues = convertCluesToV2(puzzle.clues);

      const convertedClues = puzzle.clues as {Across?: unknown[]; Down?: unknown[]};
      logger.debug(
        {
          acrossCount: convertedClues.Across?.length || 0,
          downCount: convertedClues.Down?.length || 0,
        },
        'Converted clues on retrieve'
      );

      // Remove any lowercase arrays (legacy format artifacts)
      // We only use capitalized Across/Down in ipuz v2 format
      const cluesObj = puzzle.clues as {across?: unknown; down?: unknown};
      if ('across' in cluesObj) {
        delete cluesObj.across;
      }
      if ('down' in cluesObj) {
        delete cluesObj.down;
      }
    } else {
      logger.warn(
        {
          pid,
          cluesKeys: Object.keys(puzzle.clues),
        },
        'Puzzle has clues object but all clue arrays are empty'
      );
    }
  } else {
    logger.warn({pid}, 'Puzzle has no clues object');
  }

  return puzzle;
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

// Helper to determine puzzle type from ipuz solution array length
function getPuzzleTypeFromIpuz(ipuz: {solution?: unknown}): string {
  const solution = Array.isArray(ipuz.solution) ? ipuz.solution : [];
  return solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';
}

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
      const cluesInput = normalizedPuzzle.clues as {
        Across?: unknown[];
        across?: unknown[];
        Down?: unknown[];
        down?: unknown[];
      };

      let acrossCount = 0;
      if (Array.isArray(cluesInput.Across)) {
        acrossCount = cluesInput.Across.length;
      } else if (Array.isArray(cluesInput.across)) {
        acrossCount = cluesInput.across.length;
      }

      let downCount = 0;
      if (Array.isArray(cluesInput.Down)) {
        downCount = cluesInput.Down.length;
      } else if (Array.isArray(cluesInput.down)) {
        downCount = cluesInput.down.length;
      }

      logger.debug(
        {
          hasAcross: !!cluesInput.Across,
          hasacross: !!cluesInput.across,
          hasDown: !!cluesInput.Down,
          hasdown: !!cluesInput.down,
          acrossCount,
          downCount,
        },
        'Converting clues before save'
      );

      normalizedPuzzle.clues = convertCluesToV2(normalizedPuzzle.clues);

      const convertedClues = normalizedPuzzle.clues as {Across?: unknown[]; Down?: unknown[]};
      logger.debug(
        {
          acrossCount: convertedClues.Across?.length || 0,
          downCount: convertedClues.Down?.length || 0,
        },
        'Converted clues'
      );

      // Remove any lowercase arrays (legacy format artifacts)
      // We only use capitalized Across/Down in ipuz v2 format
      const cluesObj = normalizedPuzzle.clues as {across?: unknown; down?: unknown};
      if ('across' in cluesObj) {
        delete cluesObj.across;
      }
      if ('down' in cluesObj) {
        delete cluesObj.down;
      }
    } catch (error) {
      logger.error({error}, 'Failed to convert clues');
      throw new Error(`Failed to convert clues: ${error instanceof Error ? error.message : String(error)}`);
    }
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

  // IMPORTANT: Production and staging share the same database, so we must support both formats
  // Handle old format (with info object) and ipuz format (title/author at root)
  if ('info' in puzzle && puzzle.info && typeof puzzle.info === 'object') {
    // Old format: extract from info object
    const info = puzzle.info as {
      title?: string;
      author?: string;
      copyright?: string;
      description?: string;
      type?: string;
    };
    return {
      title: info.title || '',
      author: info.author || '',
      copyright: info.copyright || '',
      description: info.description || '',
      type: info.type,
    };
  }

  // New format (ipuz): extract from root level
  return {
    title: puzzle.title || '',
    author: puzzle.author || '',
    copyright: puzzle.copyright || '',
    description: puzzle.notes || '',
    type: getPuzzleTypeFromIpuz(puzzle),
  };
}
