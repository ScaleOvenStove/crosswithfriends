-- alter_puzzle_solves_add_indexes.sql
-- Adds missing indexes to puzzle_solves for game-scoped lookups and user history ordering.
--
-- Usage:  psql -U dfacadmin -d <dbname> -f server/sql/alter_puzzle_solves_add_indexes.sql

-- Fast lookups by gid for solve checks, co-solver queries, replay data, and cleanup jobs.
-- Benefits: isGidAlreadySolved, isAlreadySolvedByUser, getPuzzleSolves, co-solver/solver-count
--           queries, game_snapshot fallback, backfillSolvesForDfacId, cleanup_game_events JOIN.
CREATE INDEX CONCURRENTLY IF NOT EXISTS puzzle_solves_gid_idx
  ON puzzle_solves (gid);

-- Composite index for user solve history sorted by solved_time DESC.
-- Benefits: getUserSolveStats history query (ORDER BY ps.solved_time DESC LIMIT 100).
CREATE INDEX CONCURRENTLY IF NOT EXISTS puzzle_solves_user_solved_time_idx
  ON puzzle_solves (user_id, solved_time DESC)
  WHERE user_id IS NOT NULL;
