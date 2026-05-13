import {pool} from './pool';
import {getDfacIdsForUser} from './user';
import {computeGamesProgress} from './game_progress';
import {refreshPuzzleRatingStats, clearPuzzleListCache} from './puzzle';

export const RATING_THRESHOLD_PERCENT = 25;

export type PuzzleRatingAggregate = {
  average: number | null;
  count: number;
  userRating: number | null;
};

export async function getRatingForPuzzle(pid: string, userId?: string): Promise<PuzzleRatingAggregate> {
  // Aggregate served by denormalized columns on puzzles, maintained by
  // upsertRating/deleteRating. Per-user rating still comes from puzzle_ratings.
  const aggregateQuery = pool.query(`SELECT rating_avg, rating_count FROM puzzles WHERE pid = $1`, [pid]);
  const userRatingQuery = userId
    ? pool.query(`SELECT rating FROM puzzle_ratings WHERE pid = $1 AND user_id = $2`, [pid, userId])
    : Promise.resolve({rows: [] as {rating: number}[]});

  const [aggResult, userResult] = await Promise.all([aggregateQuery, userRatingQuery]);
  const aggRow = aggResult.rows[0] || {rating_avg: null, rating_count: 0};

  return {
    average: aggRow.rating_avg !== null ? Number(aggRow.rating_avg) : null,
    count: Number(aggRow.rating_count) || 0,
    userRating: userResult.rows[0]?.rating ?? null,
  };
}

// Concurrent rating writes for the same puzzle must serialize so the
// recomputed aggregate matches the final puzzle_ratings state. We do that
// with FOR UPDATE on the puzzles row inside a transaction, the same pattern
// recordSolve uses.
async function withRatingTxn(pid: string, work: (client: DbClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT 1 FROM puzzles WHERE pid = $1 FOR UPDATE`, [pid]);
    await work(client);
    await refreshPuzzleRatingStats(client, pid);
    await client.query('COMMIT');
    // The list cache holds rating_avg/count/weighted from before the change.
    clearPuzzleListCache();
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{rows: any[]; rowCount?: number | null}>;
};

export async function upsertRating(pid: string, userId: string, rating: number): Promise<void> {
  await withRatingTxn(pid, async (client) => {
    await client.query(
      `INSERT INTO puzzle_ratings (pid, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (pid, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, updated_at = NOW()`,
      [pid, userId, rating]
    );
  });
}

export async function deleteRating(pid: string, userId: string): Promise<void> {
  await withRatingTxn(pid, async (client) => {
    await client.query(`DELETE FROM puzzle_ratings WHERE pid = $1 AND user_id = $2`, [pid, userId]);
  });
}

/**
 * Find every gid where the user participated for a given pid, irrespective
 * of dismissal status. getUserGamesForPuzzle filters out dismissed games
 * (correct for in-progress UIs, wrong for eligibility — a user can dismiss
 * a game they were eligible to rate from). Includes legacy firebase_history
 * games so users with only legacy plays remain eligible.
 */
async function listAllUserGameIdsForPuzzle(pid: string, userId: string): Promise<string[]> {
  const dfacIds = await getDfacIdsForUser(userId);
  if (dfacIds.length === 0) return [];
  const pidInt = Number.isFinite(Number(pid)) ? Number(pid) : null;
  const result = await pool.query(
    `SELECT DISTINCT gid FROM (
       SELECT ug.gid
       FROM (
         SELECT DISTINCT gid FROM game_events
         WHERE uid = ANY($1) OR (event_payload->'params'->>'id') = ANY($1)
       ) ug
       LEFT JOIN LATERAL (
         SELECT event_payload->'params'->>'pid' AS pid
         FROM game_events
         WHERE gid = ug.gid AND event_type = 'create' LIMIT 1
       ) ce ON true
       LEFT JOIN game_snapshots gs ON gs.gid = ug.gid
       WHERE COALESCE(ce.pid, gs.pid) = $2

       UNION

       SELECT fh.gid
       FROM firebase_history fh
       WHERE fh.dfac_id = ANY($1) AND fh.pid = $3
     ) all_gids`,
    [dfacIds, pid, pidInt]
  );
  return result.rows.map((r: {gid: string}) => r.gid);
}

/**
 * A user is eligible to rate a puzzle once they have either solved it or
 * reached RATING_THRESHOLD_PERCENT progress on at least one of their games
 * for that puzzle. computeGamesProgress replays game_events, which is heavy,
 * so callers should treat this as a write-path validation rather than a
 * per-render read.
 */
export async function hasReachedRatingThreshold(pid: string, userId: string): Promise<boolean> {
  const {rows: solveRows} = await pool.query(
    `SELECT 1 FROM puzzle_solves WHERE pid = $1 AND user_id = $2 LIMIT 1`,
    [pid, userId]
  );
  if (solveRows.length > 0) return true;

  const gids = await listAllUserGameIdsForPuzzle(pid, userId);
  if (gids.length === 0) return false;

  const progressMap = await computeGamesProgress(gids);
  for (const pct of progressMap.values()) {
    if (pct >= RATING_THRESHOLD_PERCENT) return true;
  }
  return false;
}
