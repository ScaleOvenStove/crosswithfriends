-- Returning unclaimed space to the operating system.
--
-- READ FIRST: run server/sql/adhoc/diagnose_db_space.sql and confirm
--   (a) no inactive replication slot is retaining WAL, and
--   (b) no long-running / idle-in-transaction session is pinning the xmin
--       horizon.
-- If either is true, fix that first. Repacking while the xmin horizon is
-- held will reclaim far less than expected, and the bloat comes straight
-- back.
--
-- Why this file exists: plain VACUUM (and autovacuum) marks dead rows
-- reusable inside the table's free space map, but it does not shrink the
-- file on disk. Only a rewrite returns pages to the OS. The cleanup jobs
-- delete millions of rows and then run ANALYZE, so after a large cleanup
-- the space is free *to Postgres* but still counted against the disk quota.
--
-- Ordered cheapest/safest first. Stop when you have enough headroom.

\pset pager off
\timing on

-- ===========================================================================
-- Step 1 — REINDEX CONCURRENTLY (safe, online, do this first)
-- ===========================================================================
-- B-tree indexes on high-churn tables bloat faster than the heap. Rebuilding
-- them is online (no exclusive lock, reads and writes continue) and needs
-- only about one index's worth of temporary headroom, not a full table copy.
-- On a bloated game_events this alone often recovers a large fraction of the
-- disk with essentially no risk.
--
-- Run one at a time and watch free disk between each. If a REINDEX
-- CONCURRENTLY is interrupted it leaves an invalid index named *_ccnew —
-- see the cleanup query at the bottom.

REINDEX INDEX CONCURRENTLY game_events_gid_ts_idx;
REINDEX INDEX CONCURRENTLY game_events_uid_idx;
REINDEX INDEX CONCURRENTLY game_events_payload_id_idx;
REINDEX INDEX CONCURRENTLY game_events_gid_event_type_idx;
REINDEX INDEX CONCURRENTLY game_events_gid_verified_user_idx;

REINDEX INDEX CONCURRENTLY room_events_rid_ts_idx;

REINDEX INDEX CONCURRENTLY idx_firebase_history_pid;
REINDEX INDEX CONCURRENTLY idx_firebase_history_dfac_pid;
REINDEX INDEX CONCURRENTLY idx_firebase_history_dfac_solved;
REINDEX INDEX CONCURRENTLY idx_firebase_history_gid;

-- Whole-table form (rebuilds every index on the table, still online):
--   REINDEX TABLE CONCURRENTLY game_events;

-- ===========================================================================
-- Step 2 — Drop unused indexes
-- ===========================================================================
-- Query D2 in diagnose_db_space.sql lists idx_scan per index. An index with
-- idx_scan = 0 that is neither a primary key nor a unique constraint is pure
-- cost: disk, write amplification, and vacuum work. Confirm the counter has
-- not simply been reset (check pg_stat_get_db_stat_reset_time) before acting.
--
--   DROP INDEX CONCURRENTLY <index_name>;

-- ===========================================================================
-- Step 3 — pg_repack (online table rewrite; preferred over VACUUM FULL)
-- ===========================================================================
-- Rewrites the heap without holding an exclusive lock for the duration — it
-- only needs a brief lock at the start and end. Requires the pg_repack
-- extension server-side and the pg_repack client binary.
--
--   CREATE EXTENSION IF NOT EXISTS pg_repack;
--
-- Then, from a shell (NOT psql):
--   pg_repack -d "$DATABASE_URL" -t game_events --no-kill-backend
--   pg_repack -d "$DATABASE_URL" -t room_events
--   pg_repack -d "$DATABASE_URL" -t firebase_history
--
-- DISK REQUIREMENT: pg_repack builds a full copy alongside the original, so
-- you need free space greater than the target table's total size (heap +
-- TOAST + indexes) while it runs. At 90% full you almost certainly do not
-- have that for the largest table — which is exactly why Step 1 comes first,
-- and why adding storage before repacking is the right sequence. Repack the
-- smaller tables first to free headroom for the largest one.

-- ===========================================================================
-- Step 4 — VACUUM FULL (last resort; takes the table offline)
-- ===========================================================================
-- Only if pg_repack is unavailable. VACUUM FULL holds an ACCESS EXCLUSIVE
-- lock for the entire rewrite: every read and write to the table blocks, so
-- on a large game_events this is an outage, not a maintenance window. Same
-- 2x disk requirement as pg_repack.
--
-- Schedule it, announce it, and start with the small tables.
--
--   VACUUM (FULL, ANALYZE, VERBOSE) firebase_history;
--   VACUUM (FULL, ANALYZE, VERBOSE) room_events;
--   VACUUM (FULL, ANALYZE, VERBOSE) game_snapshots;
--   VACUUM (FULL, ANALYZE, VERBOSE) game_events;   -- longest outage, do last

-- A far cheaper partial alternative when you cannot afford the lock or the
-- disk: this only trims fully-empty pages at the physical END of the table,
-- and needs a brief exclusive lock. It reclaims nothing if the free space is
-- spread through the middle of the file, which is the usual case — but it is
-- free to try.
--
--   VACUUM (VERBOSE) game_events;

-- ===========================================================================
-- Step 5 — Keep it from coming back
-- ===========================================================================
-- game_events already carries tuned autovacuum settings (see
-- create_game_events.sql). room_events does not, and it has no cleanup job
-- at all. Apply the same treatment:

ALTER TABLE room_events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 1000,
  autovacuum_vacuum_cost_delay = 10
);

-- If the diagnosis showed dead tuples persistently climbing on game_events,
-- push it further — 0.01 means autovacuum triggers at 1% churn:
--
--   ALTER TABLE game_events SET (autovacuum_vacuum_scale_factor = 0.01);
--
-- On Postgres 13+, also let index cleanup run on every pass:
--
--   ALTER TABLE game_events SET (vacuum_index_cleanup = auto);

-- ===========================================================================
-- Cleanup after an interrupted REINDEX CONCURRENTLY
-- ===========================================================================
-- Leftover invalid indexes still consume disk. Find and drop them:

SELECT c.relname AS invalid_index,
       pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE NOT i.indisvalid
ORDER BY pg_relation_size(c.oid) DESC;

--   DROP INDEX CONCURRENTLY <invalid_index_name>;
