import {pool} from './pool';
import {getUserGamesForPuzzle} from './user_games';
import {computeGamesProgress} from './game_progress';

export const RATING_THRESHOLD_PERCENT = 25;

export type PuzzleRatingAggregate = {
  average: number | null;
  count: number;
  userRating: number | null;
};

export async function getRatingForPuzzle(pid: string, userId?: string): Promise<PuzzleRatingAggregate> {
  const aggregateQuery = pool.query(
    `SELECT AVG(rating)::float AS avg, COUNT(*)::int AS count
     FROM puzzle_ratings WHERE pid = $1`,
    [pid]
  );
  const userRatingQuery = userId
    ? pool.query(`SELECT rating FROM puzzle_ratings WHERE pid = $1 AND user_id = $2`, [pid, userId])
    : Promise.resolve({rows: [] as {rating: number}[]});

  const [aggResult, userResult] = await Promise.all([aggregateQuery, userRatingQuery]);
  const aggRow = aggResult.rows[0] || {avg: null, count: 0};

  return {
    average: aggRow.avg !== null ? Number(aggRow.avg) : null,
    count: Number(aggRow.count) || 0,
    userRating: userResult.rows[0]?.rating ?? null,
  };
}

export async function upsertRating(pid: string, userId: string, rating: number): Promise<void> {
  await pool.query(
    `INSERT INTO puzzle_ratings (pid, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (pid, user_id) DO UPDATE
       SET rating = EXCLUDED.rating, updated_at = NOW()`,
    [pid, userId, rating]
  );
}

export async function deleteRating(pid: string, userId: string): Promise<void> {
  await pool.query(`DELETE FROM puzzle_ratings WHERE pid = $1 AND user_id = $2`, [pid, userId]);
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

  const games = await getUserGamesForPuzzle(pid, {userId});
  if (games.length === 0) return false;

  const gids = games.map((g) => g.gid);
  const progressMap = await computeGamesProgress(gids);
  for (const pct of progressMap.values()) {
    if (pct >= RATING_THRESHOLD_PERCENT) return true;
  }
  return false;
}
