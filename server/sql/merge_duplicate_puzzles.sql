-- Migration: Merge duplicate public puzzles by content (grid + clues)
-- Purpose: Consolidate public puzzles with identical content, keeping the oldest by uploaded_at.
--          Uses md5(grid || clues) to catch duplicates both with and without content_hash.
-- Run: psql -U dfacadmin -d <dbname> -f server/sql/merge_duplicate_puzzles.sql
-- Safety: Idempotent — safe to run multiple times. No-ops when no duplicates exist.
--
-- Usage:
--   1. Run as-is for DRY RUN (diagnostic output only, no mutations)
--   2. Set the variable below to actually execute the merge:
--        psql -v dry_run=false -f server/sql/merge_duplicate_puzzles.sql
--
-- Default: dry_run = true (safe)

\if :{?dry_run}
\else
  \set dry_run true
\endif

-- ============================================================================
-- DRY RUN: Show what would be merged
-- ============================================================================

\echo '=== Duplicate public puzzles by content (grid + clues) ==='

WITH content_hashes AS (
  SELECT pid, uploaded_at, times_solved,
    md5((content->'grid')::text || (content->'clues')::text) AS grid_hash
  FROM puzzles
  WHERE is_public = true
),
ranked AS (
  SELECT pid, grid_hash, times_solved,
    ROW_NUMBER() OVER (PARTITION BY grid_hash ORDER BY uploaded_at ASC NULLS LAST, pid ASC) AS rn,
    COUNT(*) OVER (PARTITION BY grid_hash) AS group_size
  FROM content_hashes
),
canonicals AS (
  SELECT pid AS canonical_pid, grid_hash, group_size
  FROM ranked
  WHERE rn = 1 AND group_size > 1
)
SELECT
  c.group_size,
  c.grid_hash,
  c.canonical_pid,
  c.group_size - 1 AS duplicates_to_remove,
  SUM(COALESCE(r.times_solved, 0)) AS total_dup_solves,
  (SELECT COUNT(*) FROM puzzle_solves ps
   WHERE ps.pid IN (SELECT r2.pid FROM ranked r2 WHERE r2.grid_hash = c.grid_hash AND r2.rn > 1)
  ) AS dup_solve_records,
  (SELECT COUNT(*) FROM game_snapshots gs
   WHERE gs.pid IN (SELECT r2.pid FROM ranked r2 WHERE r2.grid_hash = c.grid_hash AND r2.rn > 1)
  ) AS dup_snapshot_records
FROM canonicals c
JOIN ranked r ON r.grid_hash = c.grid_hash AND r.rn > 1
GROUP BY c.group_size, c.grid_hash, c.canonical_pid
ORDER BY c.group_size DESC
LIMIT 30;

\echo ''
\echo '=== Summary ==='
WITH content_hashes AS (
  SELECT pid,
    md5((content->'grid')::text || (content->'clues')::text) AS grid_hash
  FROM puzzles
  WHERE is_public = true
),
dupe_groups AS (
  SELECT grid_hash, COUNT(*) AS cnt
  FROM content_hashes
  GROUP BY grid_hash
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) AS duplicate_groups,
  SUM(cnt) AS total_rows_in_groups,
  SUM(cnt) - COUNT(*) AS rows_to_delete
FROM dupe_groups;

\if :dry_run
  \echo ''
  \echo 'DRY RUN — no changes made. To execute: psql -v dry_run=false -f server/sql/merge_duplicate_puzzles.sql'
  \quit
\endif

-- ============================================================================
-- MUTATION: Execute the merge
-- ============================================================================

\echo ''
\echo '=== Executing merge ==='

-- Temporarily disable statement timeout for this session (large table updates)
SET statement_timeout = 0;

BEGIN;

-- Build the mapping of duplicate -> canonical using md5(grid || clues).
-- Uses ROW_NUMBER to pick exactly one canonical per group (oldest upload, lowest pid as tiebreaker).
\echo 'Building dupe map...'
CREATE TEMP TABLE _dupe_map AS
  WITH content_hashes AS (
    SELECT pid, uploaded_at, times_solved,
      md5((content->'grid')::text || (content->'clues')::text) AS grid_hash
    FROM puzzles
    WHERE is_public = true
  ),
  ranked AS (
    SELECT pid, grid_hash, times_solved,
      ROW_NUMBER() OVER (PARTITION BY grid_hash ORDER BY uploaded_at ASC NULLS LAST, pid ASC) AS rn
    FROM content_hashes
  ),
  canonicals AS (
    SELECT pid AS canonical_pid, grid_hash
    FROM ranked
    WHERE rn = 1
    AND grid_hash IN (SELECT grid_hash FROM ranked GROUP BY grid_hash HAVING COUNT(*) > 1)
  )
  SELECT
    c.canonical_pid,
    r.pid AS dup_pid,
    COALESCE(r.times_solved, 0) AS dup_solves
  FROM canonicals c
  JOIN ranked r ON r.grid_hash = c.grid_hash AND r.rn > 1;

\echo 'Dupe map built:'
SELECT COUNT(*) AS rows_to_migrate FROM _dupe_map;

-- A. Migrate puzzle_solves (before deletion — CASCADE would lose them)
\echo 'Migrating puzzle_solves...'
INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
SELECT dm.canonical_pid, ps.gid, ps.solved_time, ps.time_taken_to_solve, ps.user_id, ps.player_count
FROM puzzle_solves ps
JOIN _dupe_map dm ON ps.pid = dm.dup_pid
ON CONFLICT DO NOTHING;

DELETE FROM puzzle_solves ps
USING _dupe_map dm
WHERE ps.pid = dm.dup_pid;

-- B. Update game_snapshots
\echo 'Updating game_snapshots...'
UPDATE game_snapshots gs
SET pid = dm.canonical_pid
FROM _dupe_map dm
WHERE gs.pid = dm.dup_pid;

-- C. Update game_events create event payloads (json column, need cast)
\echo 'Updating game_events payloads...'
UPDATE game_events ge
SET event_payload = (
  jsonb_set(ge.event_payload::jsonb, '{params,pid}', to_jsonb(dm.canonical_pid))
)::json
FROM _dupe_map dm
WHERE ge.event_type = 'create'
  AND ge.event_payload->'params'->>'pid' = dm.dup_pid;

-- D. Update firebase_history (integer pid column — only for numeric pids)
\echo 'Updating firebase_history...'
UPDATE firebase_history fh
SET pid = dm.canonical_pid::integer
FROM _dupe_map dm
WHERE dm.dup_pid ~ '^\d+$'
  AND dm.canonical_pid ~ '^\d+$'
  AND fh.pid = dm.dup_pid::integer;

-- E. Aggregate times_solved into canonical (sum all duplicates per canonical)
\echo 'Aggregating times_solved...'
UPDATE puzzles p
SET times_solved = p.times_solved + agg.total_dup_solves
FROM (
  SELECT canonical_pid, SUM(dup_solves) AS total_dup_solves
  FROM _dupe_map
  WHERE dup_solves > 0
  GROUP BY canonical_pid
) agg
WHERE p.pid = agg.canonical_pid;

-- F. Backfill content_hash on canonical puzzles that are missing it
\echo 'Backfilling content_hash on canonical puzzles...'
UPDATE puzzles p
SET content_hash = encode(
  sha256(
    convert_to(
      (content->'grid')::text || (content->'clues')::text,
      'UTF8'
    )
  ),
  'hex'
)
WHERE p.pid IN (SELECT DISTINCT canonical_pid FROM _dupe_map)
  AND p.content_hash IS NULL;

-- G. Delete duplicate puzzle rows (using DELETE ... USING for better planner)
\echo 'Deleting duplicate puzzles...'
DELETE FROM puzzles p
USING _dupe_map dm
WHERE p.pid = dm.dup_pid;

DROP TABLE _dupe_map;

COMMIT;

-- Restore default statement timeout
RESET statement_timeout;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

\echo ''
\echo '=== Verification: remaining public duplicates by content (should be 0 rows) ==='
SELECT md5((content->'grid')::text || (content->'clues')::text) AS grid_hash, COUNT(*) AS cnt
FROM puzzles
WHERE is_public = true
GROUP BY md5((content->'grid')::text || (content->'clues')::text)
HAVING COUNT(*) > 1;

\echo ''
\echo '=== Public puzzle count ==='
SELECT COUNT(*) AS public_puzzles FROM puzzles WHERE is_public = true;

\echo 'Done.'
