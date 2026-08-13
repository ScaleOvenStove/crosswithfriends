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
-- B-tree indexes do not self-compact. When old rows are deleted in key order,
-- the emptied leaf pages are only reusable for that same key range, so they
-- sit half-empty forever. Crucially this does NOT show up as dead tuples —
-- a table can report a healthy 1% n_dead_tup while its indexes carry
-- gigabytes of air, because autovacuum has already done its job and the
-- pages are simply never returned.
--
-- Rebuilding is online: no exclusive lock, reads and writes continue, and it
-- needs only about one rebuilt index of temporary headroom rather than a full
-- table copy. That makes this the only reclamation step that is safe to run
-- while the disk is nearly full — and on this schema it is also the largest
-- single win.
--
-- ORDERING: smallest first. Each completed rebuild frees space that gives the
-- next one more headroom, so by the time the largest index is rebuilt there is
-- room to build its replacement. Watch free disk between each.
--
-- To size the prize before running, use query C2 in diagnose_db_space.sql:
-- divide each index's size by the table's live row count and compare against
-- what the indexed columns should cost (~16 bytes overhead + column widths;
-- a (text_id, timestamp) index should land near 50-70 bytes/row). Calibrate
-- against a low-churn index in the same database — an append-only table's
-- primary key is a good yardstick for an unbloated entry.
--
-- If an index is bloated 4x, roughly three quarters of its size comes back.

-- Cheap probes first: they validate the operation and free a little headroom.
REINDEX INDEX CONCURRENTLY game_events_gid_verified_user_idx;
REINDEX INDEX CONCURRENTLY game_events_payload_id_idx;
REINDEX INDEX CONCURRENTLY game_events_uid_idx;

-- Then the larger ones, ascending.
REINDEX INDEX CONCURRENTLY game_events_gid_event_type_idx;

-- Largest last — on a heavily-churned game_events this is typically the most
-- bloated index in the database by a wide margin, and the biggest single
-- reclaim available anywhere in this runbook. Give it time; it rebuilds the
-- whole index while writes continue.
REINDEX INDEX CONCURRENTLY game_events_gid_ts_idx;

-- firebase_history is effectively static (no writes, no dead tuples), so its
-- indexes bloat little and the payoff here is modest. Run only if you still
-- need headroom after the game_events rebuilds.
REINDEX INDEX CONCURRENTLY idx_firebase_history_pid;
REINDEX INDEX CONCURRENTLY idx_firebase_history_dfac_pid;
REINDEX INDEX CONCURRENTLY idx_firebase_history_dfac_solved;
REINDEX INDEX CONCURRENTLY idx_firebase_history_gid;
REINDEX INDEX CONCURRENTLY firebase_history_pkey;

REINDEX INDEX CONCURRENTLY puzzle_solves_anon_game_idx;
REINDEX INDEX CONCURRENTLY puzzle_solves_gid_idx;

-- Whole-table form (rebuilds every index on the table, still online) — simpler
-- but gives up the incremental headroom that the ascending order buys you, so
-- prefer the one-at-a-time form when the disk is tight:
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
-- create_game_events.sql), and if the diagnosis showed low dead-tuple
-- percentages then autovacuum is doing its job — the bloat is structural
-- (indexes never compacting), not a vacuum shortfall. In that case do NOT
-- tune autovacuum harder; it will not help and only adds I/O.
--
-- room_events has no tuning and no cleanup job. It is small today, so this is
-- future-proofing rather than a fix — cheap to apply, no reason to wait for
-- it to become a problem:

ALTER TABLE room_events SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 1000,
  autovacuum_vacuum_cost_delay = 10
);

-- The real recurrence control for index bloat is periodic REINDEX
-- CONCURRENTLY, not vacuum settings. Schedule Step 1 for the largest
-- game_events indexes on a recurring basis (quarterly is usually enough)
-- alongside the archive job, since every large cleanup run re-creates the
-- half-empty leaf pages that Step 1 reclaims.
--
-- Only if dead tuples ARE persistently climbing, push the trigger to 1%:
--
--   ALTER TABLE game_events SET (autovacuum_vacuum_scale_factor = 0.01);

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
