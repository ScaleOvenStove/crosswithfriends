import crypto from 'crypto';
import _ from 'lodash';
import Joi from 'joi';
import {PuzzleJson, ListPuzzleRequestFilters, AddPuzzleResult} from '@shared/types';
import {pool} from './pool';
import {dayOfWeekExtract} from './sql_helpers';
import {TTLCache} from './ttl_cache';

// ================ Read and Write methods used to interface with postgres ========== //

type PuzzleListRow = {
  pid: string;
  content: PuzzleJson;
  times_solved: number;
  is_public: boolean;
  rating_avg: number | null;
  rating_count: number;
  median_solve_ms: number | null;
  solve_sample_count: number;
};

// ---- Puzzle list cache ----
const puzzleListCache = new TTLCache<PuzzleListRow[]>({
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxSize: 5_000,
  sweepIntervalMs: 10 * 60 * 1000,
});

function buildCacheKey(
  filter: ListPuzzleRequestFilters,
  limit: number,
  offset: number,
  userId?: string
): string {
  return `${JSON.stringify(filter)}:${limit}:${offset}:${userId || 'anon'}`;
}

function clearCacheForUser(userId: string): void {
  const suffix = `:${userId}`;
  puzzleListCache.deleteWhere((key) => key.endsWith(suffix));
}

export function clearPuzzleListCache(): void {
  puzzleListCache.clear();
}

// ---- Puzzle stats cache ----
// Median solve time moves glacially; aggressive caching is safe and cuts repeat queries on
// popular puzzles to a single DB hit per TTL window. Keyed by pid.
const puzzleStatsCache = new TTLCache<PuzzleStats>({
  ttlMs: 5 * 60 * 1000,
  maxSize: 5_000,
  sweepIntervalMs: 10 * 60 * 1000,
});

export function clearPuzzleStatsCache(): void {
  puzzleStatsCache.clear();
}

export async function getPuzzle(pid: string): Promise<PuzzleJson | null> {
  const {rows} = await pool.query(
    `
      SELECT content
      FROM puzzles
      WHERE pid = $1
    `,
    [pid]
  );
  const row = _.first(rows);
  return row ? row.content : null;
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

// Day-of-week extraction from puzzle titles — no alias needed here since queries reference `content` directly
const DAY_EXTRACT = dayOfWeekExtract('');

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
): Promise<PuzzleListRow[]> {
  const cacheKey = buildCacheKey(filter, limit, offset, userId);

  return puzzleListCache.getOrFetch(cacheKey, async () => {
    const parametersForTitleAuthorFilter = filter.nameOrTitleFilter.split(/\s/).map((s) => `%${s}%`);
    const parameterOffset = 3;
    // we create the query this way as POSTGRES optimizer does not use the index for an ILIKE ALL clause, but will for multiple ANDs
    // note this is not vulnerable to SQL injection because this string is just dynamically constructing params of the form $#
    const parameterizedTitleAuthorFilter = parametersForTitleAuthorFilter
      .map(
        (_s, idx) =>
          `AND (COALESCE(content->'info'->>'titleOverride', content->'info'->>'title') || ' ' || COALESCE(content->'info'->>'authorOverride', content->'info'->>'author')) ILIKE $${
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

    // Bayesian shrinkage so a single 5★ rating doesn't outrank an
    // established 4.5★ with many ratings. Constants chosen to be gentle:
    // ~5 phantom votes at the 3.5★ middle keep low-N puzzles from
    // dominating but don't drown out real signal once a puzzle has 10+
    // ratings. Tune later if rating_desc results feel off.
    const ratingPriorWeight = 5;
    const ratingPriorMean = 3.5;

    const rawMinRating = filter.minRating;
    const minRating =
      typeof rawMinRating === 'number' && rawMinRating >= 1 && rawMinRating <= 5 ? rawMinRating : 0;
    const ratingFilterClause = minRating > 0 ? `AND r.avg IS NOT NULL AND r.avg >= ${minRating}` : '';

    let orderBySpec: string;
    if (filter.sortBy === 'rating_desc') {
      orderBySpec = `r.weighted DESC NULLS LAST, pid_numeric DESC`;
    } else if (filter.sortBy === 'rating_asc') {
      orderBySpec = `r.weighted ASC NULLS LAST, pid_numeric DESC`;
    } else {
      orderBySpec = `pid_numeric DESC`;
    }
    const orderByClause = `ORDER BY ${orderBySpec}`;
    const windowOrderBy = `OVER (ORDER BY ${orderBySpec})`;

    // Stats constants are parameterized for consistency with getPuzzleStats
    // (and the rest of the codebase). Append them after the existing params
    // so we don't have to renumber title/day/userId placeholders.
    const statsTimeCapIndex = userIdParamIndex + (userId ? 1 : 0);
    const statsMinSamplesIndex = statsTimeCapIndex + 1;

    // Two-stage query so the expensive median LATERAL only runs over the
    // returned page, not every matched puzzle. The rating aggregate has to
    // be in the inner stage because filters/sort can reference its outputs;
    // it's cheap enough (AVG/COUNT over a small puzzle_ratings) that paying
    // the cost across all matched puzzles is fine. PERCENTILE_CONT is the
    // one we don't want fanning out — see EXPLAIN notes in the PR.
    //
    // puzzle_ratings shares only `pid` with puzzles, so the filter clauses
    // (content/is_public/uploaded_by/pid_numeric) remain unambiguous after
    // the LATERAL join in the inner stage.
    const {rows} = await pool.query(
      `
      WITH page AS (
        SELECT puzzles.pid, uploaded_at, is_public, times_solved,
          content->'info' AS info,
          jsonb_array_length(content->'grid') AS grid_rows,
          jsonb_array_length(content->'grid'->0) AS grid_cols,
          (content->>'contest')::boolean AS contest,
          r.avg AS rating_avg,
          COALESCE(r.count, 0) AS rating_count,
          -- Tag each row with its sort position so the outer query can
          -- preserve order after the median LATERAL join. SQL doesn't
          -- guarantee row order survives subsequent joins.
          ROW_NUMBER() ${windowOrderBy} AS sort_idx
        FROM puzzles
        LEFT JOIN LATERAL (
          SELECT
            AVG(rating)::float AS avg,
            COUNT(*)::int AS count,
            CASE WHEN COUNT(*) > 0
                 THEN ((${ratingPriorWeight} * ${ratingPriorMean}) + SUM(rating))::float / (${ratingPriorWeight} + COUNT(*))
                 ELSE NULL
            END AS weighted
          FROM puzzle_ratings
          WHERE pid = puzzles.pid
        ) r ON true
        WHERE ${visibilityClause}
        ${sizeClause}
        ${typeClause}
        ${parameterizedTitleAuthorFilter}
        ${dayClause}
        ${ratingFilterClause}
        ${orderByClause}
        LIMIT $1
        OFFSET $2
      )
      SELECT page.*,
        s.median_ms AS median_solve_ms,
        COALESCE(s.sample_count, 0) AS solve_sample_count
      FROM page
      LEFT JOIN LATERAL (
        -- Mirrors getPuzzleStats: collapse co-op solves to one per gid via
        -- MAX(time), then median over those when we have a stable sample.
        SELECT
          COUNT(*)::int AS sample_count,
          CASE WHEN COUNT(*) >= $${statsMinSamplesIndex}
            THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_ms)::int
            ELSE NULL
          END AS median_ms
        FROM (
          SELECT MAX(ps.time_taken_to_solve) AS time_ms
          FROM puzzle_solves ps
          WHERE ps.pid = page.pid
            AND ps.time_taken_to_solve > 0
            AND ps.time_taken_to_solve < $${statsTimeCapIndex}
          GROUP BY ps.gid
        ) game_times
      ) s ON true
      ORDER BY page.sort_idx
    `,
      [
        limit,
        offset,
        ...parametersForTitleAuthorFilter,
        ...dayParams,
        ...userIdParams,
        PUZZLE_STATS_TIME_CAP_MS,
        PUZZLE_STATS_MIN_SAMPLES,
      ]
    );
    const puzzles: PuzzleListRow[] = rows.map(
      (row: {
        pid: string;
        uploaded_at: string;
        is_public: boolean;
        info: PuzzleJson['info'];
        grid_rows: number;
        grid_cols: number;
        contest: boolean | null;
        times_solved: string;
        rating_avg: number | null;
        rating_count: number;
        median_solve_ms: number | string | null;
        solve_sample_count: number | string;
        // NOTE: numeric returns as string in pg-promise
        // See https://stackoverflow.com/questions/39168501/pg-promise-returns-integers-as-strings
      }) => ({
        pid: row.pid,
        is_public: row.is_public,
        times_solved: Number(row.times_solved),
        rating_avg: row.rating_avg !== null ? Number(row.rating_avg) : null,
        rating_count: Number(row.rating_count) || 0,
        median_solve_ms: row.median_solve_ms !== null ? Number(row.median_solve_ms) : null,
        solve_sample_count: Number(row.solve_sample_count) || 0,
        // Reconstruct a minimal content object with just the fields the frontend uses:
        // - info (title, author, type)
        // - grid (only dimensions matter — build a skeleton array)
        // - contest flag
        content: {
          info: row.info || {},
          grid: Array.from({length: row.grid_rows || 0}, () => new Array(row.grid_cols || 0).fill('')),
          contest: row.contest || undefined,
        } as PuzzleJson,
      })
    );
    return puzzles;
  });
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
    titleOverride: string().optional(),
    authorOverride: string().optional(),
  }),
  circles: Joi.array().optional(),
  shades: Joi.array().optional(),
  images: Joi.object()
    .pattern(
      Joi.number(),
      Joi.string()
        .pattern(/^data:image\//)
        .message('Image values must be data: URIs')
    )
    .optional(),
  clues: Joi.object({
    across: Joi.array(),
    down: Joi.array(),
  }),
  private: Joi.boolean().optional(),
  contest: Joi.boolean().optional(),
});

function validatePuzzle(puzzle: any) {
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
  const puzzleId = pid || crypto.randomUUID().slice(0, 8);
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
  // Clear uploader's cached puzzle list so they see their new puzzle immediately
  if (uploadedBy) clearCacheForUser(uploadedBy);

  return {pid: puzzleId, duplicate: false};
}

export async function getUserUploadedPuzzles(userId: string) {
  const {rows} = await pool.query(
    `SELECT pid,
            COALESCE(content->'info'->>'titleOverride', content->'info'->>'title') as title,
            CASE WHEN content->'info'->>'titleOverride' IS NOT NULL THEN content->'info'->>'title' END as original_title,
            COALESCE(content->'info'->>'authorOverride', content->'info'->>'author') as author,
            CASE WHEN content->'info'->>'authorOverride' IS NOT NULL THEN content->'info'->>'author' END as original_author,
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
    originalTitle: r.original_title || undefined,
    author: r.author || undefined,
    originalAuthor: r.original_author || undefined,
    uploadedAt: r.uploaded_at,
    timesSolved: Number(r.times_solved),
    size: `${r.rows}x${r.cols}`,
    isPublic: !!r.is_public,
  }));
}

async function isGidAlreadySolved(gid: string) {
  const {
    rows: [{count}],
  } = await pool.query(`SELECT COUNT(*) FROM puzzle_solves WHERE gid=$1 AND user_id IS NULL`, [gid]);
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

    const insertResult = await client.query(
      `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
       VALUES ($1, $2, to_timestamp($3), $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [pid, gid, solved_time / 1000.0, timeToSolve, userId || null, playerCount || 1]
    );
    if (insertResult.rowCount === 1 && isFirstSolveForGame) {
      await client.query(`UPDATE puzzles SET times_solved = times_solved + 1 WHERE pid = $1`, [pid]);
    }
    await client.query('COMMIT');
    if (insertResult.rowCount === 1) {
      puzzleStatsCache.delete(pid);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`[recordSolve] failed for pid=${pid} gid=${gid}:`, e);
    throw e;
  } finally {
    client.release();
  }
}

export async function getPuzzleInfo(pid: string) {
  const puzzle = await getPuzzle(pid);
  if (!puzzle) return null;
  const {info = {}} = puzzle;
  return info;
}

// Solves longer than this are treated as "started a game, came back days later" rather than
// real attempts. Two hours covers slow Sunday solvers without letting overnight idles skew the
// median.
export const PUZZLE_STATS_TIME_CAP_MS = 2 * 60 * 60 * 1000;

// Hide the median until we have a stable sample. Below this it's too noisy to be useful as a
// difficulty signal.
export const PUZZLE_STATS_MIN_SAMPLES = 25;

export type PuzzleStats = {
  sampleCount: number;
  medianMs: number | null;
};

export async function getPuzzleStats(pid: string): Promise<PuzzleStats> {
  return puzzleStatsCache.getOrFetch(pid, async () => {
    // Aggregate to one row per gid first: a co-op game has one puzzle_solves row per
    // authenticated user, and counting each as a separate sample would weight the
    // median toward larger teams. MAX(time) per gid picks the longest-present user's
    // clock — closest to total game duration, since each user's clock starts when
    // they join. MIN would bias downward toward the latest joiner.
    // We do not exclude reveal-assisted solves: that would require joining game_events,
    // whose history is deleted by the archival job once a game is solved. Filtering
    // there would drift over time as old games get cleaned up. The median is robust
    // enough to typical reveal usage at this sample threshold; a future revision can
    // persist a durable per-solve "had_reveals" flag.
    const {rows} = await pool.query(
      `WITH game_times AS (
         SELECT ps.gid, MAX(ps.time_taken_to_solve) AS time_ms
         FROM puzzle_solves ps
         WHERE ps.pid = $1
           AND ps.time_taken_to_solve > 0
           AND ps.time_taken_to_solve < $2
         GROUP BY ps.gid
       )
       SELECT
         COUNT(*)::int AS sample_count,
         CASE WHEN COUNT(*) >= $3
           THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_ms)::int
           ELSE NULL
         END AS median_ms
       FROM game_times`,
      [pid, PUZZLE_STATS_TIME_CAP_MS, PUZZLE_STATS_MIN_SAMPLES]
    );
    const row = rows[0] || {sample_count: 0, median_ms: null};
    return {
      sampleCount: Number(row.sample_count) || 0,
      medianMs: row.median_ms != null ? Number(row.median_ms) : null,
    };
  });
}
