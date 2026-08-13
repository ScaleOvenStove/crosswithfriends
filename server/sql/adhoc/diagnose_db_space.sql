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

-- C2. Index bloat WITHOUT pgstattuple — bytes per row per index.
--     This is the most useful single query in the file, because B-tree indexes
--     do not self-compact: after a mass delete, emptied leaf pages are only
--     reused for the same key range, so a table that deletes old rows by an
--     ascending key leaves permanently half-empty pages. n_dead_tup will look
--     perfectly healthy while the index carries gigabytes of air.
--
--     Read it by comparing bytes_per_row against what the indexed columns
--     should cost: roughly 16 bytes of per-entry overhead plus the column
--     widths. A narrow (text_id, timestamp) index should land near 50-70
--     bytes per row. Three or four times that is bloat, and REINDEX
--     CONCURRENTLY reclaims the difference online.
--
--     Calibrate against a low-churn index in this same database rather than
--     against theory — an append-only table's primary key makes a good
--     baseline for what an unbloated entry costs here.
SELECT s.relname AS table_name,
       s.indexrelname AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
       t.n_live_tup,
       round(pg_relation_size(s.indexrelid)::numeric / NULLIF(t.n_live_tup, 0), 1) AS bytes_per_row,
       s.idx_scan
FROM pg_stat_user_indexes s
JOIN pg_stat_user_tables t ON t.relid = s.relid
WHERE pg_relation_size(s.indexrelid) > 50 * 1024 * 1024
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- C2b. If pgstattuple can be installed, it measures density directly rather
--      than inferring it. Try this first — on managed Postgres it is often
--      permitted even when other extensions are not:
--
--        CREATE EXTENSION IF NOT EXISTS pgstattuple;
--
--      Then avg_leaf_density is the answer outright: 90 is freshly built,
--      anything under ~50 means roughly half the index is empty space.
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
--     circles) per game, so they dominate bytes-per-row and are what fills
--     the TOAST segment.
--
--     SAMPLED: an unqualified aggregate over game_events detoasts every
--     payload and will blow the statement timeout on a table this size.
--     TABLESAMPLE SYSTEM reads a random fraction of PAGES, which is fast and
--     plenty accurate for a size distribution. Raise the percentage for a
--     tighter estimate; multiply the counts by (100 / pct) to extrapolate.
SELECT event_type,
       COUNT(*) AS sampled_rows,
       COUNT(*) * 1000 AS est_total_rows,  -- 0.1% sample
       pg_size_pretty(AVG(pg_column_size(event_payload))::bigint) AS avg_payload,
       pg_size_pretty((SUM(pg_column_size(event_payload)::bigint) * 1000)) AS est_total_payload
FROM game_events TABLESAMPLE SYSTEM (0.1)
GROUP BY event_type
ORDER BY SUM(pg_column_size(event_payload)::bigint) DESC;

-- E2. Reclaimable by stripping params.game from create events of games that
--     already have a non-replay snapshot. These payloads are redundant: the
--     server rebuilds them from the puzzles table via
--     buildCreateEventFromPuzzle() in server/model/game.ts.
--     This is what Category 4 of archive_game_events.ts removes.
--
--     SAMPLED: driven off a bounded slice of game_snapshots so it does an
--     indexed probe per sampled gid instead of scanning game_events. Scale
--     the result by (total non-replay snapshots / SAMPLE_SIZE) — get that
--     denominator from E2b below.
WITH sample AS (
  SELECT gid FROM game_snapshots WHERE replay_retained = false LIMIT 5000
)
SELECT COUNT(*) AS sampled_create_events,
       pg_size_pretty(AVG(pg_column_size(ge.event_payload))::bigint) AS avg_create_payload,
       pg_size_pretty(SUM(pg_column_size(ge.event_payload)::bigint)) AS sampled_bytes
FROM sample s
JOIN game_events ge ON ge.gid = s.gid AND ge.event_type = 'create'
WHERE ge.event_payload->'params'->'game' IS NOT NULL;

-- E2b. The scaling denominator for E2.
SELECT COUNT(*) AS non_replay_snapshots FROM game_snapshots WHERE replay_retained = false;

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
-- B3 looks HEALTHY (low dead_pct, recent last_autovacuum) but the disk is
-- still full
--     -> Do not stop here, and do not conclude there is no reclaimable space.
--        Healthy dead-tuple numbers mean autovacuum already ran; they say
--        nothing about how much empty space it left behind. Go to C2: index
--        bloat is invisible in these numbers and is usually the answer,
--        because B-tree pages emptied by a mass delete are never returned.
--
-- C2 shows an index costing several times its expected bytes_per_row
--     -> That difference is reclaimable online via REINDEX CONCURRENTLY, with
--        no exclusive lock and no 2x-disk requirement. This is the safest and
--        usually the largest single win. See reclaim_space.sql Step 1.
--
-- C1/C3 show large free/reclaimable space in the HEAP
--     -> Real, but more expensive to collect: it needs a full table rewrite
--        (pg_repack or VACUUM FULL), which requires free space greater than
--        the table's total size. Do the index rebuilds first and add storage
--        before attempting it.
--
-- E1/E2 show 'create' dominating payload bytes
--     -> Structural growth, not bloat. Run Category 4 of
--        archive_game_events.ts, then repack to realize the space.
