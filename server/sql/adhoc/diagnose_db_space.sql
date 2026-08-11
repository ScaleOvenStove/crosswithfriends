-- Database space diagnosis: "we run cleanup jobs but the disk keeps growing"
--
-- Run these read-only queries on production, top to bottom. They answer, in order:
--   A. Is the disk being held by something other than table data? (WAL, slots)
--   B. Is anything blocking autovacuum from reclaiming deleted rows?
--   C. How much of each table is dead/unclaimed space vs. live data?
--   D. Which tables and indexes are actually holding the bytes?
--
-- Interpretation cheat-sheet at the bottom.
--
--   psql "$DATABASE_URL" -f server/sql/adhoc/diagnose_db_space.sql

\pset pager off

-- ===========================================================================
-- A. Space held outside of table data
-- ===========================================================================

-- A1. Total database size, for reference against the provider's disk gauge.
--     If this is well under the reported disk usage, the gap is WAL, logs,
--     or temp files — not table data, and no amount of row deletion helps.
SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;

-- A2. Replication slots. An inactive slot pins WAL forever and, worse, holds
--     back the xmin horizon so autovacuum CANNOT reclaim any deleted row in
--     the entire cluster. This is the single most common cause of
--     "cleanup runs, nothing shrinks."
SELECT slot_name, slot_type, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS wal_retained,
       xmin, catalog_xmin
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) DESC NULLS LAST;

-- A3. Total WAL on disk. Compare against max_wal_size / wal_keep_size.
SELECT pg_size_pretty(SUM(size)) AS wal_total, COUNT(*) AS wal_segments
FROM pg_ls_waldir();

SELECT name, setting, unit FROM pg_settings
WHERE name IN ('max_wal_size', 'min_wal_size', 'wal_keep_size', 'archive_mode',
               'autovacuum', 'autovacuum_naptime', 'old_snapshot_threshold');

-- ===========================================================================
-- B. Things that block reclamation
-- ===========================================================================

-- B1. Long-running or idle-in-transaction sessions. Any open transaction holds
--     the xmin horizon; rows deleted after it started cannot be reclaimed,
--     so the table grows even while the cleanup job reports success.
SELECT pid, state, wait_event_type, wait_event,
       age(backend_xmin) AS xmin_age,
       now() - xact_start AS xact_age,
       now() - state_change AS idle_for,
       left(query, 120) AS query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL OR state = 'idle in transaction'
ORDER BY age(backend_xmin) DESC NULLS LAST;

-- B2. Prepared (two-phase) transactions — same xmin-pinning effect, but
--     invisible in pg_stat_activity. Should normally be empty.
SELECT gid, prepared, owner, database FROM pg_prepared_xacts ORDER BY prepared;

-- B3. Per-table autovacuum health. dead tuples that never drop, or a
--     last_autovacuum that is old/NULL on a high-churn table, means
--     autovacuum is not keeping up (or is blocked by B1/A2).
SELECT relname,
       n_live_tup, n_dead_tup,
       CASE WHEN n_live_tup > 0
            THEN round(100.0 * n_dead_tup / n_live_tup, 1) END AS dead_pct,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
       vacuum_count, autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- ===========================================================================
-- C. How much space is unclaimed (bloat)
-- ===========================================================================

-- C1. Requires the pgstattuple extension (available on most managed Postgres):
--       CREATE EXTENSION IF NOT EXISTS pgstattuple;
--     free_percent is the space already reclaimed by VACUUM into the free
--     space map — reusable by this table, but NOT returned to the OS.
--     That is the "unclaimed space" a VACUUM FULL / pg_repack would release.
--
--     pgstattuple_approx is cheap; pgstattuple() does a full scan (slow on
--     large tables) but is exact. Start with the approximate form.
--
-- SELECT 'game_events' AS table_name, * FROM pgstattuple_approx('game_events');
-- SELECT 'room_events'  AS table_name, * FROM pgstattuple_approx('room_events');
-- SELECT 'game_snapshots' AS table_name, * FROM pgstattuple_approx('game_snapshots');
-- SELECT 'firebase_history' AS table_name, * FROM pgstattuple_approx('firebase_history');

-- C2. Index bloat, if pgstattuple is available. B-tree indexes on high-churn
--     tables bloat faster than the heap and are far cheaper to fix
--     (REINDEX CONCURRENTLY — no exclusive lock, ~1x index size of headroom).
--
-- SELECT indexrelname,
--        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
--        (SELECT avg_leaf_density FROM pgstatindex(indexrelid::regclass::text)) AS leaf_density
-- FROM pg_stat_user_indexes
-- WHERE pg_relation_size(indexrelid) > 10 * 1024 * 1024
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- C3. Bloat estimate WITHOUT pgstattuple — pure catalog math, no scan.
--     Compares actual pages against the minimum pages the live rows need.
--     Approximate, but good enough to decide whether a repack is worth it.
SELECT relname,
       pg_size_pretty(pg_relation_size(oid)) AS heap_size,
       n_live_tup,
       pg_size_pretty(
         GREATEST(pg_relation_size(oid)
                  - (n_live_tup * (COALESCE(avg_width, 0) + 28)), 0)::bigint
       ) AS est_reclaimable
FROM pg_class c
JOIN pg_stat_user_tables t ON t.relid = c.oid
LEFT JOIN LATERAL (
  SELECT SUM(avg_width)::bigint AS avg_width
  FROM pg_stats WHERE schemaname = 'public' AND tablename = c.relname
) s ON true
WHERE c.relkind = 'r' AND pg_relation_size(oid) > 10 * 1024 * 1024
ORDER BY pg_relation_size(oid) DESC;

-- ===========================================================================
-- D. Where the bytes actually are
-- ===========================================================================

-- D1. Top relations by total size, split into heap / TOAST / indexes.
--     TOAST holds the compressed json payloads; for game_events it is often
--     larger than the heap itself, and it bloats and repacks independently.
SELECT c.relname,
       pg_size_pretty(pg_total_relation_size(c.oid))                    AS total,
       pg_size_pretty(pg_relation_size(c.oid))                          AS heap,
       pg_size_pretty(COALESCE(pg_total_relation_size(c.reltoastrelid), 0)) AS toast,
       pg_size_pretty(pg_indexes_size(c.oid))                           AS indexes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;

-- D2. Every index, largest first, with usage counts. An index with
--     idx_scan = 0 that is not a constraint is pure overhead: it costs disk,
--     slows every write, and can be dropped outright.
SELECT s.relname AS table_name, s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
       s.idx_scan, i.indisunique, i.indisprimary
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
ORDER BY pg_relation_size(s.indexrelid) DESC
LIMIT 30;

-- ===========================================================================
-- E. Growth drivers specific to this schema
-- ===========================================================================

-- E1. game_events by type, with payload bytes. 'create' rows are a small
--     count but carry a full copy of the puzzle (grid + solution + clues +
--     circles) per game, so they usually dominate bytes-per-row.
SELECT event_type, COUNT(*) AS rows,
       pg_size_pretty(SUM(pg_column_size(event_payload)::bigint)) AS payload_bytes,
       pg_size_pretty(AVG(pg_column_size(event_payload))::bigint) AS avg_row
FROM game_events
GROUP BY event_type
ORDER BY SUM(pg_column_size(event_payload)::bigint) DESC;

-- E2. Reclaimable by stripping params.game from create events of games that
--     already have a non-replay snapshot. These payloads are redundant: the
--     server rebuilds them from the puzzles table via
--     buildCreateEventFromPuzzle() in server/model/game.ts.
--     This is what Category 4 of archive_game_events.ts removes.
SELECT COUNT(*) AS create_events,
       pg_size_pretty(SUM(pg_column_size(ge.event_payload)::bigint)) AS current_bytes,
       pg_size_pretty(AVG(pg_column_size(ge.event_payload))::bigint) AS avg_row
FROM game_events ge
JOIN game_snapshots gs ON gs.gid = ge.gid
WHERE ge.event_type = 'create'
  AND gs.replay_retained = false
  AND ge.event_payload->'params'->'game' IS NOT NULL;

-- E3. room_events has no cleanup job and no autovacuum tuning. Check whether
--     it has quietly become a growth driver.
SELECT COUNT(*) AS rows,
       MIN(ts) AS oldest, MAX(ts) AS newest,
       pg_size_pretty(SUM(pg_column_size(event_payload)::bigint)) AS payload_bytes
FROM room_events;

-- E4. Auth token tables are cleaned on an interval by server.ts, but confirm
--     the sweep is actually keeping up (expired rows should be near zero).
SELECT 'refresh_tokens' AS t, COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired, COUNT(*) AS total
FROM refresh_tokens
UNION ALL
SELECT 'email_verification_tokens', COUNT(*) FILTER (WHERE expires_at < NOW()), COUNT(*)
FROM email_verification_tokens
UNION ALL
SELECT 'password_reset_tokens', COUNT(*) FILTER (WHERE expires_at < NOW()), COUNT(*)
FROM password_reset_tokens;

-- ===========================================================================
-- Interpretation
-- ===========================================================================
--
-- A2 shows an inactive slot retaining WAL
--     -> That is the leak. Drop it (SELECT pg_drop_replication_slot('name'))
--        and space frees immediately. Until it is gone, nothing else helps.
--
-- B1 shows a session with a large xmin_age or 'idle in transaction'
--     -> Autovacuum is blocked cluster-wide. Terminate it, then re-run
--        the cleanup job; the deletes only become reclaimable afterward.
--
-- B3 shows high n_dead_tup that does not fall between runs
--     -> Autovacuum is not keeping up. Deletes are converting live rows into
--        dead rows without ever releasing the pages.
--
-- C1/C3 show large free/reclaimable space, B3 is healthy
--     -> This is the normal case, and the answer to "is there unclaimed
--        space?" is yes. VACUUM has already freed the rows internally, but
--        Postgres never returns those pages to the OS on its own. You need a
--        rewrite: see server/sql/adhoc/reclaim_space.sql.
--
-- E1/E2 show 'create' dominating payload bytes
--     -> Structural growth, not bloat. Run Category 4 of
--        archive_game_events.ts, then repack to realize the space.
