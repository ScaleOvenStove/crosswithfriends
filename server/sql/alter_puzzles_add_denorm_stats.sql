-- Denormalize solve-time and rating aggregates onto puzzles so the homepage
-- list query can read them as plain columns instead of running PERCENTILE_CONT
-- + AVG/COUNT subqueries per page. Maintenance happens transactionally inside
-- recordSolve / upsertRating / deleteRating.
--
-- Run on existing databases BEFORE deploying the code that reads from these
-- columns. The new code also writes to them, so the order must be:
--   1) run this migration (additive; old code ignores new columns)
--   2) deploy code that reads and writes the new columns
--
-- Constants kept in sync with server/model/puzzle.ts:
--   PUZZLE_STATS_TIME_CAP_MS = 7200000  (2 hours)
--   PUZZLE_STATS_MIN_SAMPLES = 25
-- and server/model/puzzle.ts rating prior:
--   ratingPriorWeight = 5
--   ratingPriorMean   = 3.5

ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS median_solve_ms integer;
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS solve_sample_count integer NOT NULL DEFAULT 0;
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS rating_avg double precision;
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS rating_weighted double precision;

-- Sort by rating_weighted hits this often enough to want an index. Partial
-- index skips rows with no ratings — they sort NULLS LAST anyway.
CREATE INDEX IF NOT EXISTS puzzles_rating_weighted_idx
  ON puzzles (rating_weighted DESC NULLS LAST)
  WHERE rating_weighted IS NOT NULL;

-- ----- Backfill solve stats -----
-- Mirrors getPuzzleStats: collapse co-op solves to one per gid via MAX(time),
-- then PERCENTILE_CONT over those once the per-pid sample count is stable.
WITH game_times AS (
  SELECT ps.pid, ps.gid, MAX(ps.time_taken_to_solve) AS time_ms
  FROM puzzle_solves ps
  WHERE ps.time_taken_to_solve > 0
    AND ps.time_taken_to_solve < 7200000
  GROUP BY ps.pid, ps.gid
),
solve_stats AS (
  SELECT pid,
    COUNT(*)::int AS sample_count,
    CASE WHEN COUNT(*) >= 25
      THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_ms)::int
      ELSE NULL
    END AS median_ms
  FROM game_times
  GROUP BY pid
)
UPDATE puzzles p
SET solve_sample_count = solve_stats.sample_count,
    median_solve_ms = solve_stats.median_ms
FROM solve_stats
WHERE p.pid = solve_stats.pid;

-- ----- Backfill rating stats -----
WITH rating_agg AS (
  SELECT pid,
    AVG(rating)::float AS avg,
    COUNT(*)::int AS count,
    ((5 * 3.5) + SUM(rating))::float / (5 + COUNT(*)) AS weighted
  FROM puzzle_ratings
  GROUP BY pid
)
UPDATE puzzles p
SET rating_avg = rating_agg.avg,
    rating_count = rating_agg.count,
    rating_weighted = rating_agg.weighted
FROM rating_agg
WHERE p.pid = rating_agg.pid;
