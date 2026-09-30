-- Sort indexes for the time_desc / time_asc puzzle list sorts.
-- Run this migration on existing databases before deploy.
--
-- Both directions sort NULLS LAST (puzzles below the min-sample threshold
-- have no median), which a backward scan of a single index cannot produce,
-- so each direction gets its own index. pid_numeric DESC is the tiebreak
-- listPuzzles uses.

CREATE INDEX IF NOT EXISTS puzzles_median_solve_desc_idx
  ON puzzles (median_solve_ms DESC NULLS LAST, pid_numeric DESC);

CREATE INDEX IF NOT EXISTS puzzles_median_solve_asc_idx
  ON puzzles (median_solve_ms ASC NULLS LAST, pid_numeric DESC);
