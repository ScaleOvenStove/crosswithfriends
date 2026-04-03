import {pool} from './pool';
import {dayOfWeekExtract} from './sql_helpers';
import {TTLCache} from './ttl_cache';

// ---- In-memory TTL cache for in-progress games ----
const inProgressGamesCache = new TTLCache<InProgressGameItem[]>({ttlMs: 5 * 60_000, maxSize: 2_000});

export function clearInProgressGamesCache(): void {
  inProgressGamesCache.clear();
}

export function invalidateInProgressCacheForUser(userId: string): void {
  inProgressGamesCache.delete(userId);
}

export type UserSolveHistoryItem = {
  pid: string;
  gid: string;
  title: string;
  originalTitle?: string;
  size: string;
  dow: string | null;
  time: number;
  solvedAt: string;
  playerCount: number;
  coSolvers: {userId: string; displayName: string}[];
  anonCount: number;
};

export type SizeStats = {
  size: string;
  count: number;
  avgTime: number;
};

export type DayOfWeekStats = {
  day: string;
  count: number;
  avgTime: number;
};

export async function getUserSolveStats(userId: string): Promise<{
  totalSolved: number;
  totalSolvedSolo: number;
  totalSolvedCoop: number;
  bySize: SizeStats[];
  byDay: DayOfWeekStats[];
  bySizeSolo: SizeStats[];
  bySizeCoop: SizeStats[];
  byDaySolo: DayOfWeekStats[];
  byDayCoop: DayOfWeekStats[];
  history: UserSolveHistoryItem[];
}> {
  // Run size+day stats query and history query in parallel.
  // Both use lightweight JSONB extraction (no full content fetch).
  const [combinedStatsResult, historyResult] = await Promise.all([
    // Combined size + day stats split by solve mode (solo/coop/all) in a single scan.
    // mode_solves: best time per puzzle per mode; all_solves: best time per puzzle overall.
    pool.query(
      `WITH mode_solves AS (
        SELECT DISTINCT ON (ps.pid, CASE WHEN COALESCE(ps.player_count, 1) = 1 THEN 'solo' ELSE 'coop' END)
          ps.pid,
          ps.time_taken_to_solve AS best_time,
          CASE WHEN COALESCE(ps.player_count, 1) = 1 THEN 'solo' ELSE 'coop' END AS solve_mode,
          GREATEST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
            || 'x' ||
          LEAST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
            AS size,
          ${dayOfWeekExtract('p')} AS dow
        FROM puzzle_solves ps
        JOIN puzzles p ON ps.pid = p.pid
        WHERE ps.user_id = $1
        ORDER BY ps.pid, CASE WHEN COALESCE(ps.player_count, 1) = 1 THEN 'solo' ELSE 'coop' END, ps.time_taken_to_solve ASC
      ),
      all_solves AS (
        SELECT DISTINCT ON (pid) pid, best_time, size, dow
        FROM mode_solves ORDER BY pid, best_time ASC
      )
      SELECT 'size' AS stat_type, solve_mode, size AS key, COUNT(*)::int AS count, ROUND(AVG(best_time))::int AS avg_time
      FROM mode_solves GROUP BY solve_mode, size
      UNION ALL
      SELECT 'size', 'all', size, COUNT(*)::int, ROUND(AVG(best_time))::int
      FROM all_solves GROUP BY size
      UNION ALL
      SELECT 'day', solve_mode, dow, COUNT(*)::int, ROUND(AVG(best_time))::int
      FROM mode_solves WHERE dow IS NOT NULL GROUP BY solve_mode, dow
      UNION ALL
      SELECT 'day', 'all', dow, COUNT(*)::int, ROUND(AVG(best_time))::int
      FROM all_solves WHERE dow IS NOT NULL GROUP BY dow`,
      [userId]
    ),
    // Recent solve history — only extract needed JSONB fields
    pool.query(
      `SELECT
         ps.pid, ps.gid, ps.time_taken_to_solve, ps.solved_time, ps.player_count,
         COALESCE(p.content->'info'->>'titleOverride', p.content->'info'->>'title') AS title,
         CASE WHEN p.content->'info'->>'titleOverride' IS NOT NULL THEN p.content->'info'->>'title' END AS original_title,
         GREATEST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
           || 'x' ||
         LEAST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
           AS size,
         ${dayOfWeekExtract('p')} AS dow
       FROM puzzle_solves ps
       JOIN puzzles p ON ps.pid = p.pid
       WHERE ps.user_id = $1
       ORDER BY ps.solved_time DESC
       LIMIT 100`,
      [userId]
    ),
  ]);

  // Parse combined stats result into per-mode buckets
  const statsByMode: Record<string, {bySize: SizeStats[]; byDay: DayOfWeekStats[]; total: number}> = {
    all: {bySize: [], byDay: [], total: 0},
    solo: {bySize: [], byDay: [], total: 0},
    coop: {bySize: [], byDay: [], total: 0},
  };
  for (const r of combinedStatsResult.rows) {
    const bucket = statsByMode[r.solve_mode] || statsByMode.all;
    if (r.stat_type === 'size') {
      bucket.bySize.push({size: r.key, count: r.count, avgTime: r.avg_time});
      bucket.total += r.count;
    } else {
      bucket.byDay.push({day: r.key, count: r.count, avgTime: r.avg_time});
    }
  }
  // Sort bySize by count descending for each mode
  for (const mode of Object.values(statsByMode)) {
    mode.bySize.sort((a, b) => b.count - a.count);
  }

  // For collaborative solves, batch co-solver + count into a single query
  const collabGids = historyResult.rows.filter((r: any) => r.player_count > 1).map((r: any) => r.gid);

  const coSolverMap: Map<string, {userId: string; displayName: string}[]> = new Map();
  const solverCountMap: Map<string, number> = new Map();

  if (collabGids.length > 0) {
    // Single query for both co-solvers and solver counts
    const coSolverResult = await pool.query(
      `SELECT ps.gid, ps.user_id, u.display_name,
              COUNT(*) OVER (PARTITION BY ps.gid) AS solver_count
       FROM puzzle_solves ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.gid = ANY($1) AND ps.user_id IS NOT NULL`,
      [collabGids]
    );
    for (const row of coSolverResult.rows) {
      solverCountMap.set(row.gid, Number(row.solver_count));
      if (row.user_id !== userId) {
        const list = coSolverMap.get(row.gid) || [];
        list.push({userId: row.user_id, displayName: row.display_name});
        coSolverMap.set(row.gid, list);
      }
    }
  }

  const history: UserSolveHistoryItem[] = historyResult.rows.map((r: any) => {
    const pc = r.player_count || 1;
    const authenticatedCount = solverCountMap.get(r.gid) || 1;
    return {
      pid: r.pid,
      gid: r.gid,
      title: r.title || 'Untitled',
      originalTitle: r.original_title || undefined,
      size: r.size,
      dow: r.dow || null,
      time: Number(r.time_taken_to_solve),
      solvedAt: r.solved_time ? r.solved_time.toISOString() : '',
      playerCount: pc,
      coSolvers: coSolverMap.get(r.gid) || [],
      anonCount: Math.max(0, pc - authenticatedCount),
    };
  });

  return {
    totalSolved: statsByMode.all.total,
    totalSolvedSolo: statsByMode.solo.total,
    totalSolvedCoop: statsByMode.coop.total,
    bySize: statsByMode.all.bySize,
    byDay: statsByMode.all.byDay,
    bySizeSolo: statsByMode.solo.bySize,
    bySizeCoop: statsByMode.coop.bySize,
    byDaySolo: statsByMode.solo.byDay,
    byDayCoop: statsByMode.coop.byDay,
    history,
  };
}

export type InProgressGameItem = {
  gid: string;
  pid: string;
  title: string;
  originalTitle?: string;
  size: string;
  lastActivity: string;
  percentComplete: number;
};

export async function getInProgressGames(userId: string): Promise<InProgressGameItem[]> {
  return inProgressGamesCache.getOrFetch(userId, async () => {
    // Look up the user's legacy dfac_id(s)
    const idResult = await pool.query('SELECT dfac_id FROM user_identity_map WHERE user_id = $1', [userId]);
    const dfacIds = idResult.rows.map((r: {dfac_id: string}) => r.dfac_id);

    if (dfacIds.length === 0) {
      return [];
    }

    // Find in-progress games:
    // - UNION of uid-based and payload-based lookups (each uses its own index)
    // - Include unsolved firebase_history entries (legacy games not in game_events)
    // - Exclude solved games via NOT EXISTS on game_snapshots (PK lookup)
    // - Exclude user-dismissed games via NOT EXISTS on game_dismissals
    // - Join create event for pid, join puzzles for title and size
    const result = await pool.query(
      `WITH user_games AS (
         SELECT gid, MAX(ts) AS last_activity
         FROM (
           SELECT gid, ts FROM game_events WHERE uid = ANY($1)
           UNION ALL
           SELECT gid, ts FROM game_events WHERE (event_payload->'params'->>'id') = ANY($1)
           UNION ALL
           -- Legacy unsolved games from firebase_history not already in game_events
           SELECT fh.gid, to_timestamp(fh.activity_time / 1000) AS ts
           FROM firebase_history fh
           WHERE fh.dfac_id = ANY($1) AND fh.solved = false
             AND NOT EXISTS (
               SELECT 1 FROM game_events ge WHERE ge.gid = fh.gid AND (ge.uid = ANY($1) OR (ge.event_payload->'params'->>'id') = ANY($1))
             )
         ) all_events
         WHERE NOT EXISTS (
           SELECT 1 FROM game_snapshots gs WHERE gs.gid = all_events.gid
         )
         AND NOT EXISTS (
           SELECT 1 FROM game_dismissals gd WHERE gd.gid = all_events.gid AND gd.user_id = $2
         )
         GROUP BY gid
         ORDER BY last_activity DESC
         LIMIT 20
       )
       SELECT
         ug.gid,
         COALESCE(ce.event_payload->'params'->>'pid', fh.pid::text) AS pid,
         COALESCE(p.content->'info'->>'titleOverride', p.content->'info'->>'title', p2.content->'info'->>'titleOverride', p2.content->'info'->>'title', 'Untitled') AS title,
         CASE WHEN COALESCE(p.content->'info'->>'titleOverride', p2.content->'info'->>'titleOverride') IS NOT NULL THEN COALESCE(p.content->'info'->>'title', p2.content->'info'->>'title') END AS original_title,
         COALESCE(
           GREATEST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text
             || 'x' ||
           LEAST(jsonb_array_length(p.content->'grid'), jsonb_array_length(p.content->'grid'->0))::text,
           GREATEST(jsonb_array_length(p2.content->'grid'), jsonb_array_length(p2.content->'grid'->0))::text
             || 'x' ||
           LEAST(jsonb_array_length(p2.content->'grid'), jsonb_array_length(p2.content->'grid'->0))::text
         ) AS size,
         ug.last_activity
       FROM user_games ug
       LEFT JOIN game_events ce ON ce.gid = ug.gid AND ce.event_type = 'create'
       LEFT JOIN puzzles p ON p.pid = (ce.event_payload->'params'->>'pid')
       LEFT JOIN firebase_history fh ON fh.gid = ug.gid AND fh.dfac_id = ANY($1)
       LEFT JOIN puzzles p2 ON p2.pid = fh.pid::text
       WHERE COALESCE(ce.event_payload->'params'->>'pid', fh.pid::text) IS NOT NULL
       ORDER BY ug.last_activity DESC`,
      [dfacIds, userId]
    );

    return result.rows.map((r: any) => ({
      gid: r.gid,
      pid: r.pid,
      title: r.title || 'Untitled',
      originalTitle: r.original_title || undefined,
      size: r.size,
      lastActivity: r.last_activity ? r.last_activity.toISOString() : '',
      percentComplete: 0,
    }));
  });
}

export async function backfillSolvesForDfacId(userId: string, dfacId: string): Promise<number> {
  // Find anonymous puzzle_solves for games where this dfac_id participated
  const result = await pool.query(
    `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
     SELECT ps.pid, ps.gid, ps.solved_time, ps.time_taken_to_solve, $1, ps.player_count
     FROM puzzle_solves ps
     WHERE ps.user_id IS NULL
       AND ps.gid IN (
         SELECT gid FROM game_events WHERE uid = $2
         UNION
         SELECT gid FROM game_events WHERE event_payload->'params'->>'id' = $2
       )
     ON CONFLICT DO NOTHING`,
    [userId, dfacId]
  );
  const count = result.rowCount || 0;
  return count;
}

export type SolvedPuzzleType = {
  pid: string;
  gid: string;
  solved_time: Date;
  time_taken_to_solve: number;
  revealed_squares_count: number;
  checked_squares_count: number;
  title: string;
  size: string;
};

export async function getPuzzleSolves(gids: string[]): Promise<SolvedPuzzleType[]> {
  if (gids.length === 0) return [];

  // Two separate queries instead of a cartesian JOIN:
  // 1. Get solve records with lightweight puzzle metadata (no full content)
  // 2. Get aggregated check/reveal counts per game

  const [{rows: solveRows}, {rows: eventRows}] = await Promise.all([
    pool.query(
      `SELECT
        ps.pid, ps.gid, ps.solved_time, ps.time_taken_to_solve,
        COALESCE(p.content->'info'->>'titleOverride', p.content->'info'->>'title') AS title,
        jsonb_array_length(p.content->'grid') AS grid_rows,
        jsonb_array_length(p.content->'grid'->0) AS grid_cols
      FROM puzzle_solves ps
      JOIN puzzles p ON ps.pid = p.pid
      WHERE ps.gid = ANY($1)
      ORDER BY ps.solved_time DESC`,
      [gids]
    ),
    pool.query(
      `SELECT gid, event_type, event_payload->'params'->'scope' AS scope
      FROM game_events
      WHERE gid = ANY($1) AND event_type IN ('check', 'reveal')`,
      [gids]
    ),
  ]);

  // Build reveal/check sets per puzzle
  const revealedSquareByGid = new Map<string, Set<string>>();
  const checkedSquareByGid = new Map<string, Set<string>>();
  for (const row of eventRows) {
    const cells: string[] = (row.scope || []).map((c: {r: number; c: number}) => JSON.stringify(c));
    if (row.event_type === 'reveal') {
      const set = revealedSquareByGid.get(row.gid) || new Set();
      cells.forEach(set.add, set);
      revealedSquareByGid.set(row.gid, set);
    } else if (row.event_type === 'check') {
      const set = checkedSquareByGid.get(row.gid) || new Set();
      cells.forEach(set.add, set);
      checkedSquareByGid.set(row.gid, set);
    }
  }

  // Deduplicate by pid (keep first seen)
  const seen = new Set<string>();
  const puzzleSolves: SolvedPuzzleType[] = [];
  for (const row of solveRows) {
    if (seen.has(row.pid)) continue;
    seen.add(row.pid);
    puzzleSolves.push({
      pid: row.pid,
      gid: row.gid,
      title: row.title || 'Untitled',
      size: `${row.grid_rows || 0}x${row.grid_cols || 0}`,
      solved_time: new Date(row.solved_time),
      time_taken_to_solve: Number(row.time_taken_to_solve),
      revealed_squares_count: (revealedSquareByGid.get(row.gid) || new Set()).size,
      checked_squares_count: (checkedSquareByGid.get(row.gid) || new Set()).size,
    });
  }

  return puzzleSolves;
}
