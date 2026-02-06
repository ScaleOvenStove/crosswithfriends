import _ from 'lodash';
import Joi from 'joi';
import * as uuid from 'uuid';
import {PuzzleJson, ListPuzzleRequestFilters} from '@shared/types';
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

const buildTypeFilterClause = (typeFilter: ListPuzzleRequestFilters['typeFilter']): string => {
  if ((typeFilter.Standard && typeFilter.Cryptic) || (!typeFilter.Standard && !typeFilter.Cryptic)) {
    return '';
  }
  if (typeFilter.Cryptic && !typeFilter.Standard) {
    return `AND (content->'info'->>'title') ~* '(cryptic|quiptic)'`;
  }
  return `AND NOT ((content->'info'->>'title') ~* '(cryptic|quiptic)')`;
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
    const dayList = selectedDays.map((_, i) => `$${paramOffset + i}`);
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
  offset: number
): Promise<
  {
    pid: string;
    content: PuzzleJson;
    times_solved: number;
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

  const {rows} = await pool.query(
    `
      SELECT pid, uploaded_at, content, times_solved
      FROM puzzles
      WHERE is_public = true
      ${sizeClause}
      ${typeClause}
      ${parameterizedTitleAuthorFilter}
      ${dayClause}
      ORDER BY pid_numeric DESC
      LIMIT $1
      OFFSET $2
    `,
    [limit, offset, ...parametersForTitleAuthorFilter, ...dayParams]
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
});

function validatePuzzle(puzzle: any) {
  console.log(_.keys(puzzle));
  const {error} = puzzleValidator.validate(puzzle);
  if (error) {
    throw new Error(error.message);
  }
}

export async function addPuzzle(puzzle: PuzzleJson, isPublic = false, pid?: string) {
  if (!pid) {
    pid = uuid.v4().substr(0, 8);
  }
  validatePuzzle(puzzle);
  const uploaded_at = Date.now();
  await pool.query(
    `
      INSERT INTO puzzles (pid, uploaded_at, is_public, content, pid_numeric)
      VALUES ($1, to_timestamp($2), $3, $4, $5)`,
    [pid, uploaded_at / 1000, isPublic, puzzle, pid]
  );
  return pid;
}

async function isGidAlreadySolved(gid: string) {
  // Note: This gate makes use of the assumption "one pid per gid";
  // The unique index on (pid, gid) is more strict than this
  const {
    rows: [{count}],
  } = await pool.query(
    `
    SELECT COUNT(*)
    FROM puzzle_solves
    WHERE gid=$1
  `,
    [gid]
  );
  return count > 0;
}

export async function recordSolve(pid: string, gid: string, timeToSolve: number) {
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
