import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import Joi from 'joi';
import * as uuid from 'uuid';

import {logger} from '../utils/logger.js';

import {pool} from './pool.js';

// ================ Read and Write methods used to interface with postgres ========== //

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
        const hasDownWord =
          startsDown && r < height - 1 && nextRow?.[c] !== '.' && nextRow?.[c] !== '#';

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

  // Convert clues from sparse array format to ipuz format
  const oldAcross = oldPuzzle.clues?.across || [];
  const oldDown = oldPuzzle.clues?.down || [];

  const acrossClues: [string, string][] = [];
  for (let i = 1; i < oldAcross.length; i += 2) {
    const number = oldAcross[i];
    const clue = oldAcross[i + 1];
    if (number && clue) {
      acrossClues.push([number, clue]);
    }
  }

  const downClues: [string, string][] = [];
  for (let i = 1; i < oldDown.length; i += 2) {
    const number = oldDown[i];
    const clue = oldDown[i + 1];
    if (number && clue) {
      downClues.push([number, clue]);
    }
  }

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
  return convertOldFormatToIpuz(firstRow.content);
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

const string = (): Joi.StringSchema => Joi.string().allow(''); // https://github.com/sideway/joi/blob/master/API.md#string

// Validator for ipuz format per https://www.puzzazz.com/ipuz/v1 and v2
const puzzleValidator = Joi.object({
  version: string().required(), // Supports both v1 and v2
  kind: Joi.array().items(string()).required(),
  dimensions: Joi.object({
    width: Joi.number().integer().required(),
    height: Joi.number().integer().required(),
  }).required(),
  title: string().required(),
  author: string().required(),
  copyright: string().optional(),
  notes: string().optional(),
  solution: Joi.array()
    .items(
      Joi.array()
        .items(Joi.alternatives().try(string(), Joi.valid(null, '#')))
        .min(1)
    )
    .min(1)
    .required(),
  puzzle: Joi.array()
    .items(
      Joi.array().items(
        Joi.alternatives().try(
          Joi.number(),
          Joi.string(), // Allow string clue numbers like "1", "2", "10", "0" for empty
          Joi.object({
            cell: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
            style: Joi.object({
              shapebg: string().optional(),
              fillbg: string().optional(),
            }).optional(),
          }),
          Joi.valid(null)
        )
      )
    )
    .required(),
  clues: Joi.object({
    Across: Joi.array()
      .items(
        Joi.alternatives().try(
          Joi.array().items(string()), // v1 format: ["1", "clue text"]
          Joi.object({
            number: string(),
            clue: string(),
            cells: Joi.array().optional(), // v2 format with cells property
          })
        )
      )
      .required(),
    Down: Joi.array()
      .items(
        Joi.alternatives().try(
          Joi.array().items(string()), // v1 format: ["1", "clue text"]
          Joi.object({
            number: string(),
            clue: string(),
            cells: Joi.array().optional(), // v2 format with cells property
          })
        )
      )
      .required(),
  }).required(),
});

function validatePuzzle(puzzle: unknown): void {
  logger.debug({keys: puzzle && typeof puzzle === 'object' ? Object.keys(puzzle) : []}, 'Puzzle keys');
  const {error} = puzzleValidator.validate(puzzle);
  if (error) {
    throw new Error(error.message);
  }

  // Ensure solution array is not empty
  if (puzzle && typeof puzzle === 'object' && 'solution' in puzzle) {
    const solution = (puzzle as {solution?: unknown}).solution;
    if (!Array.isArray(solution) || solution.length === 0) {
      throw new Error('Puzzle solution array must not be empty');
    }
    if (!Array.isArray(solution[0]) || solution[0].length === 0) {
      throw new Error('Puzzle solution must have at least one non-empty row');
    }
  }
}

export async function addPuzzle(puzzle: PuzzleJson, isPublic = false, pid?: string): Promise<string> {
  let puzzleId = pid;
  if (!puzzleId) {
    puzzleId = uuid.v4().substring(0, 8);
  }
  validatePuzzle(puzzle);
  const uploaded_at = Date.now();
  await pool.query(
    `
      INSERT INTO puzzles (pid, uploaded_at, is_public, content, pid_numeric)
      VALUES ($1, to_timestamp($2), $3, $4, $5)`,
    [puzzleId, uploaded_at / 1000, isPublic, puzzle, puzzleId]
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
