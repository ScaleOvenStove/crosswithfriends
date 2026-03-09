import {pool} from './pool';
import {getDfacIdsForUser} from './user';
import {computeGamesProgress} from './game_progress';

export type PuzzleStatusMap = {[pid: string]: 'solved' | 'started'};

/**
 * Get puzzle statuses (solved/started) for a guest user by dfac_id.
 * Returns a map of pid -> 'solved' | 'started'.
 *
 * Combines two data sources:
 *  1. game_events (v2 games tracked in PG)
 *  2. firebase_history (legacy games migrated from Firebase)
 */
export async function getGuestPuzzleStatuses(dfacId: string): Promise<PuzzleStatusMap> {
  const result = await pool.query(
    `SELECT pid, CASE WHEN bool_or(solved) THEN 'solved' ELSE 'started' END AS status
     FROM (
       -- v2 games from game_events
       SELECT
         ce.event_payload->'params'->>'pid' AS pid,
         gs.gid IS NOT NULL AS solved
       FROM (
         SELECT gid FROM game_events WHERE uid = $1
         UNION
         SELECT gid FROM game_events WHERE (event_payload->'params'->>'id') = $1
       ) user_gids
       JOIN game_events ce ON ce.gid = user_gids.gid AND ce.event_type = 'create'
       LEFT JOIN game_snapshots gs ON gs.gid = user_gids.gid
       WHERE ce.event_payload->'params'->>'pid' IS NOT NULL

       UNION ALL

       -- Legacy games from firebase_history
       SELECT fh.pid::text AS pid, fh.solved
       FROM firebase_history fh
       WHERE fh.dfac_id = $1
     ) combined
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
  // Combines game_events (v2) with firebase_history (legacy).
  const result = await pool.query(
    `WITH user_games AS (
       -- v2 games from game_events
       SELECT gid, MAX(ts) AS last_activity, true AS v2
       FROM (
         SELECT gid, ts FROM game_events WHERE uid = ANY($1)
         UNION ALL
         SELECT gid, ts FROM game_events WHERE (event_payload->'params'->>'id') = ANY($1)
       ) all_events
       ${options.userId ? 'WHERE NOT EXISTS (SELECT 1 FROM game_dismissals gd WHERE gd.gid = all_events.gid AND gd.user_id = $3)' : ''}
       GROUP BY gid

       UNION ALL

       -- Legacy games from firebase_history
       SELECT fh.gid, to_timestamp(fh.activity_time / 1000) AS last_activity, false AS v2
       FROM firebase_history fh
       WHERE fh.dfac_id = ANY($1) AND fh.pid::text = $2
         AND NOT EXISTS (
           SELECT 1 FROM game_events ge WHERE ge.gid = fh.gid AND (ge.uid = ANY($1) OR (ge.event_payload->'params'->>'id') = ANY($1))
         )
     )
     SELECT
       ug.gid,
       COALESCE(ce.event_payload->'params'->>'pid', $2) AS pid,
       CASE WHEN gs.gid IS NOT NULL THEN true ELSE false END AS solved,
       ug.last_activity,
       ug.v2
     FROM user_games ug
     LEFT JOIN game_events ce ON ce.gid = ug.gid AND ce.event_type = 'create'
     LEFT JOIN game_snapshots gs ON gs.gid = ug.gid
     WHERE COALESCE(ce.event_payload->'params'->>'pid', $2) = $2
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
    percentComplete: r.solved ? 100 : (progressMap.get(r.gid) ?? 0),
  }));
}
