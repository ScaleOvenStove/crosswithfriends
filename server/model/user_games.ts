import {pool} from './pool';
import {getDfacIdsForUser} from './user';
import {computeGamesProgress} from './game_progress';

export type PuzzleStatusMap = {[pid: string]: 'solved' | 'started'};

/**
 * Get puzzle statuses (solved/started) for a guest user by dfac_id.
 * Returns a map of pid -> 'solved' | 'started'.
 */
export async function getGuestPuzzleStatuses(dfacId: string): Promise<PuzzleStatusMap> {
  const result = await pool.query(
    `WITH guest_games AS (
       SELECT DISTINCT ge.gid,
         ce.event_payload->'params'->>'pid' AS pid,
         CASE WHEN gs.gid IS NOT NULL THEN true ELSE false END AS solved
       FROM game_events ge
       JOIN game_events ce ON ce.gid = ge.gid AND ce.event_type = 'create'
       LEFT JOIN game_snapshots gs ON gs.gid = ge.gid
       WHERE ge.uid = $1 OR (ge.event_payload->'params'->>'id') = $1
     )
     SELECT pid,
       CASE WHEN bool_or(solved) THEN 'solved' ELSE 'started' END AS status
     FROM guest_games
     WHERE pid IS NOT NULL
     GROUP BY pid`,
    [dfacId]
  );

  const statuses: PuzzleStatusMap = {};
  for (const row of result.rows as {pid: string; status: 'solved' | 'started'}[]) {
    statuses[row.pid] = row.status;
  }
  return statuses;
}

type UserGameRow = {
  gid: string;
  pid: string;
  solved: boolean;
  last_activity: Date | null;
  v2: boolean;
};

export type UserGameItem = {
  gid: string;
  pid: string;
  solved: boolean;
  time: number;
  v2: boolean;
  percentComplete: number;
};

/**
 * Get a user's games for a specific puzzle.
 * Supports both authenticated users (userId lookup) and guests (raw dfacId).
 */
export async function getUserGamesForPuzzle(
  pid: string,
  options: {userId?: string; dfacId?: string}
): Promise<UserGameItem[]> {
  const dfacIds: string[] = [];

  if (options.userId) {
    const userDfacIds = await getDfacIdsForUser(options.userId);
    dfacIds.push(...userDfacIds);
  }

  if (options.dfacId && !dfacIds.includes(options.dfacId)) {
    dfacIds.push(options.dfacId);
  }

  if (dfacIds.length === 0) {
    return [];
  }

  // Find games where the user participated AND the game is for the requested puzzle.
  // Uses the same CTE pattern as getInProgressGames() but:
  //   - Filters by pid (via create event)
  //   - Includes solved games (not just in-progress)
  //   - Excludes dismissed games for authenticated users
  const result = await pool.query(
    `WITH user_games AS (
       SELECT gid, MAX(ts) AS last_activity
       FROM (
         SELECT gid, ts FROM game_events WHERE uid = ANY($1)
         UNION ALL
         SELECT gid, ts FROM game_events WHERE (event_payload->'params'->>'id') = ANY($1)
       ) all_events
       ${options.userId ? 'WHERE NOT EXISTS (SELECT 1 FROM game_dismissals gd WHERE gd.gid = all_events.gid AND gd.user_id = $3)' : ''}
       GROUP BY gid
     )
     SELECT
       ug.gid,
       ce.event_payload->'params'->>'pid' AS pid,
       CASE WHEN gs.gid IS NOT NULL THEN true ELSE false END AS solved,
       ug.last_activity,
       true AS v2
     FROM user_games ug
     JOIN game_events ce ON ce.gid = ug.gid AND ce.event_type = 'create'
     LEFT JOIN game_snapshots gs ON gs.gid = ug.gid
     WHERE ce.event_payload->'params'->>'pid' = $2
     ORDER BY ug.last_activity DESC`,
    options.userId ? [dfacIds, pid, options.userId] : [dfacIds, pid]
  );

  const rows: UserGameRow[] = result.rows;
  const unsolved = rows.filter((r) => !r.solved).map((r) => r.gid);
  const progressMap = unsolved.length > 0 ? await computeGamesProgress(unsolved) : new Map();

  return rows.map((r) => ({
    gid: r.gid,
    pid: r.pid,
    solved: r.solved,
    time: r.last_activity ? new Date(r.last_activity).getTime() : 0,
    v2: r.v2,
    percentComplete: progressMap.get(r.gid) ?? 0,
  }));
}
