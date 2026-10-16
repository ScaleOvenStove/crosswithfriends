-- Sort indexes for the solves_desc / solves_asc puzzle list sorts.
-- Run this migration on existing databases before deploy.
--
-- Both directions sort NULLS LAST, which a backward scan of a single index
-- cannot produce, so each direction gets its own index. pid_numeric DESC is
-- the tiebreak listPuzzles uses.

CREATE INDEX CONCURRENTLY IF NOT EXISTS puzzles_times_solved_desc_idx
  ON puzzles (times_solved DESC NULLS LAST, pid_numeric DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS puzzles_times_solved_asc_idx
  ON puzzles (times_solved ASC NULLS LAST, pid_numeric DESC);
