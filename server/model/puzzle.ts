import crypto from 'crypto';
import _ from 'lodash';
import Joi from 'joi';
import * as uuid from 'uuid';
import {PuzzleJson, ListPuzzleRequestFilters, AddPuzzleResult} from '@shared/types';
import {pool} from './pool';

// ================ Read and Write methods used to interface with postgres ========== //

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
  console.log(`getPuzzle (${pid}) took ${ms}ms`);
  return _.first(rows)!.content;
}

const GRID_MAX_DIM = `GREATEST(jsonb_array_length(content->'grid'), jsonb_array_length(content->'grid'->0))`;
const TITLE_HAS_MINI = `(content->'info'->>'title') ~* '\\mmini\\M'`;
const TITLE_HAS_MIDI = `(content->'info'->>'title') ~* '\\mmidi\\M'`;

const buildSizeFilterClause = (sizeFilter: ListPuzzleRequestFilters['sizeFilter']): string => {
  const allSelected = sizeFilter.Mini && sizeFilter.Midi && sizeFilter.Standard && sizeFilter.Large;
  const noneSelected = !sizeFilter.Mini && !sizeFilter.Midi && !sizeFilter.Standard && !sizeFilter.Large;
  if (allSelected || noneSelected) return '';

  // Size classification: title takes priority over grid size
  // Mini: title contains "mini" (not "midi"), OR grid ≤8 without "midi" in title
  // Midi: title contains "midi", OR grid 9-12 without "mini" in title
  // Standard: 13-16 without mini/midi in title
  // Large: ≥17 without mini/midi in title
  const conditions: string[] = [];
  if (sizeFilter.Mini) {
    conditions.push(
      `(${TITLE_HAS_MINI} AND NOT ${TITLE_HAS_MIDI}) OR (${GRID_MAX_DIM} <= 8 AND NOT ${TITLE_HAS_MIDI})`
    );
  }
  if (sizeFilter.Midi) {
    conditions.push(`${TITLE_HAS_MIDI} OR (${GRID_MAX_DIM} BETWEEN 9 AND 12 AND NOT ${TITLE_HAS_MINI})`);
  }
  if (sizeFilter.Standard)
    conditions.push(`${GRID_MAX_DIM} BETWEEN 13 AND 16 AND NOT ${TITLE_HAS_MINI} AND NOT ${TITLE_HAS_MIDI}`);
  if (sizeFilter.Large)
    conditions.push(`${GRID_MAX_DIM} >= 17 AND NOT ${TITLE_HAS_MINI} AND NOT ${TITLE_HAS_MIDI}`);

  return `AND (${conditions.join(' OR ')})`;
};

const IS_CRYPTIC = `(content->'info'->>'title') ~* '(cryptic|quiptic)'`;
const IS_CONTEST = `(content->>'contest')::boolean IS TRUE`;

const buildTypeFilterClause = (typeFilter: ListPuzzleRequestFilters['typeFilter']): string => {
  const allSelected = typeFilter.Standard && typeFilter.Cryptic && typeFilter.Contest;
  const noneSelected = !typeFilter.Standard && !typeFilter.Cryptic && !typeFilter.Contest;
  if (allSelected || noneSelected) return '';

  const conditions: string[] = [];
  if (typeFilter.Standard) conditions.push(`(NOT ${IS_CRYPTIC} AND NOT ${IS_CONTEST})`);
  if (typeFilter.Cryptic) conditions.push(IS_CRYPTIC);
  if (typeFilter.Contest) conditions.push(IS_CONTEST);

  return `AND (${conditions.join(' OR ')})`;
};

// Case-insensitive day extraction with support for various abbreviations (Mon, Tues, Weds, Thurs, etc.)
const DAY_EXTRACT = `
  CASE
    WHEN UPPER(content->'info'->>'title') ~ '\\m(MONDAY|MON)\\M' THEN 'Mon'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(TUESDAY|TUE|TUES)\\M' THEN 'Tue'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(WEDNESDAY|WED|WEDS)\\M' THEN 'Wed'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(THURSDAY|THU|THURS)\\M' THEN 'Thu'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(FRIDAY|FRI)\\M' THEN 'Fri'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(SATURDAY|SAT)\\M' THEN 'Sat'
    WHEN UPPER(content->'info'->>'title') ~ '\\m(SUNDAY|SUN)\\M' THEN 'Sun'
    ELSE NULL
  END
`;

const buildDayOfWeekFilterClause = (
  dayFilter: ListPuzzleRequestFilters['dayOfWeekFilter'],
  paramOffset: number
): {clause: string; params: string[]} => {
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const selectedDays = dayKeys.filter((k) => dayFilter[k]);
  const includeUnknown = dayFilter.Unknown;

  const allSelected = selectedDays.length === 7 && includeUnknown;
  const noneSelected = selectedDays.length === 0 && !includeUnknown;
  if (allSelected || noneSelected) return {clause: '', params: []};

  const conditions: string[] = [];

  if (selectedDays.length > 0) {
    const dayList = selectedDays.map((_day, i) => `$${paramOffset + i}`);
    conditions.push(`${DAY_EXTRACT} IN (${dayList.join(', ')})`);
  }

  if (includeUnknown) {
    conditions.push(`${DAY_EXTRACT} IS NULL`);
  }

  return {
    clause: `AND (${conditions.join(' OR ')})`,
    params: [...selectedDays],
  };
};

export async function listPuzzles(
  filter: ListPuzzleRequestFilters,
  limit: number,
  offset: number,
  userId?: string
): Promise<
  {
    pid: string;
    content: PuzzleJson;
    times_solved: number;
    is_public: boolean;
  }[]
> {
  const startTime = Date.now();
  const parametersForTitleAuthorFilter = filter.nameOrTitleFilter.split(/\s/).map((s) => `%${s}%`);
  const parameterOffset = 3;
  // we create the query this way as POSTGRES optimizer does not use the index for an ILIKE ALL clause, but will for multiple ANDs
  // note this is not vulnerable to SQL injection because this string is just dynamically constructing params of the form $#
  const parameterizedTitleAuthorFilter = parametersForTitleAuthorFilter
    .map(
      (_s, idx) =>
        `AND ((content -> 'info' ->> 'title') || ' ' || (content->'info'->>'author')) ILIKE $${
          idx + parameterOffset
        }`
    )
    .join('\n');

  const sizeClause = buildSizeFilterClause(filter.sizeFilter);
  const typeClause = buildTypeFilterClause(filter.typeFilter);
  const dayParamOffset = parameterOffset + parametersForTitleAuthorFilter.length;
  const {clause: dayClause, params: dayParams} = buildDayOfWeekFilterClause(
    filter.dayOfWeekFilter,
    dayParamOffset
  );

  // If authenticated, also show the user's own unlisted puzzles
  const userIdParamIndex = dayParamOffset + dayParams.length;
  const visibilityClause = userId
    ? `(is_public = true OR uploaded_by = $${userIdParamIndex})`
    : 'is_public = true';
  const userIdParams = userId ? [userId] : [];

  const {rows} = await pool.query(
    `
      SELECT pid, uploaded_at, is_public, content, times_solved
      FROM puzzles
      WHERE ${visibilityClause}
      ${sizeClause}
      ${typeClause}
      ${parameterizedTitleAuthorFilter}
      ${dayClause}
      ORDER BY pid_numeric DESC
      LIMIT $1
      OFFSET $2
    `,
    [limit, offset, ...parametersForTitleAuthorFilter, ...dayParams, ...userIdParams]
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
  console.log(`listPuzzles (${JSON.stringify(filter)}, ${limit}, ${offset}) took ${ms}ms`);
  return puzzles;
}

const string = () => Joi.string().allow(''); // https://github.com/sideway/joi/blob/master/API.md#string

const puzzleValidator = Joi.object({
  grid: Joi.array().items(Joi.array().items(string())),
  info: Joi.object({
    type: string().optional(),
    title: string(),
    author: string(),
    copyright: string().optional(),
    description: string().optional(),
  }),
  circles: Joi.array().optional(),
  shades: Joi.array().optional(),
  clues: Joi.object({
    across: Joi.array(),
    down: Joi.array(),
  }),
  private: Joi.boolean().optional(),
  contest: Joi.boolean().optional(),
});

function validatePuzzle(puzzle: any) {
  console.log(_.keys(puzzle));
  const {error} = puzzleValidator.validate(puzzle);
  if (error) {
    throw new Error(error.message);
  }
}

function computePuzzleHash(puzzle: PuzzleJson): string {
  const canonical = JSON.stringify({
    clues: {across: puzzle.clues.across, down: puzzle.clues.down},
    grid: puzzle.grid,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function addPuzzle(
  puzzle: PuzzleJson,
  isPublic = false,
  pid?: string,
  uploadedBy?: string | null
): Promise<AddPuzzleResult> {
  const puzzleId = pid || uuid.v4().substr(0, 8);
  validatePuzzle(puzzle);
  const contentHash = computePuzzleHash(puzzle);

  if (isPublic) {
    const {rows} = await pool.query(`SELECT pid FROM puzzles WHERE content_hash = $1 AND is_public = true`, [
      contentHash,
    ]);
    if (rows.length > 0) {
      return {pid: rows[0].pid, duplicate: true};
    }
  }

  const uploaded_at = Date.now();
  await pool.query(
    `
      INSERT INTO puzzles (pid, uploaded_at, is_public, content, pid_numeric, content_hash, uploaded_by)
      VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7)`,
    [puzzleId, uploaded_at / 1000, isPublic, puzzle, puzzleId, contentHash, uploadedBy || null]
  );
  return {pid: puzzleId, duplicate: false};
}

export async function getUserUploadedPuzzles(userId: string) {
  const {rows} = await pool.query(
    `SELECT pid, content->'info'->>'title' as title,
            uploaded_at, times_solved, is_public,
            jsonb_array_length(content->'grid') as rows,
            jsonb_array_length(content->'grid'->0) as cols
     FROM puzzles
     WHERE uploaded_by = $1
     ORDER BY uploaded_at DESC
     LIMIT 100`,
    [userId]
  );
  return rows.map((r: any) => ({
    pid: r.pid,
    title: r.title || 'Untitled',
    uploadedAt: r.uploaded_at,
    timesSolved: Number(r.times_solved),
    size: `${r.rows}x${r.cols}`,
    isPublic: !!r.is_public,
  }));
}

async function isGidAlreadySolved(gid: string) {
  const {
    rows: [{count}],
  } = await pool.query(`SELECT COUNT(*) FROM puzzle_solves WHERE gid=$1`, [gid]);
  return count > 0;
}

async function isAlreadySolvedByUser(gid: string, userId: string) {
  const {
    rows: [{count}],
  } = await pool.query(`SELECT COUNT(*) FROM puzzle_solves WHERE gid=$1 AND user_id=$2`, [gid, userId]);
  return count > 0;
}

export async function recordSolve(
  pid: string,
  gid: string,
  timeToSolve: number,
  userId?: string | null,
  playerCount?: number
) {
  const solved_time = Date.now();

  // Dedup: authenticated users get one record per game, anonymous gets one per game
  if (userId) {
    if (await isAlreadySolvedByUser(gid, userId)) return;
  } else {
    if (await isGidAlreadySolved(gid)) return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the puzzle row to serialize concurrent solves for the same puzzle
    await client.query(`SELECT 1 FROM puzzles WHERE pid = $1 FOR UPDATE`, [pid]);

    const {
      rows: [{count}],
    } = await client.query(`SELECT COUNT(*) FROM puzzle_solves WHERE gid = $1`, [gid]);
    const isFirstSolveForGame = Number(count) === 0;

    await client.query(
      `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
       VALUES ($1, $2, to_timestamp($3), $4, $5, $6)`,
      [pid, gid, solved_time / 1000.0, timeToSolve, userId || null, playerCount || 1]
    );
    if (isFirstSolveForGame) {
      await client.query(`UPDATE puzzles SET times_solved = times_solved + 1 WHERE pid = $1`, [pid]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

export async function getPuzzleInfo(pid: string) {
  const puzzle = await getPuzzle(pid);
  const {info = {}} = puzzle;
  return info;
}
