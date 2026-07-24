-- diagnose_user_games_timeout.sql
-- Diagnostics for the Postgres statement_timeout errors on the read paths
-- (Sentry: NODE-EXPRESS-E "GET /api/user-games", plus /api/user-stats).
--
-- These queries are all READ-ONLY (SELECT / EXPLAIN). Nothing here mutates data.
--
-- Usage:
--   psql -U dfacadmin -d <dbname> -f server/sql/diagnose_user_games_timeout.sql
--
-- Work top to bottom:
--   Section 1 answers "are the perf indexes actually deployed?" — the cheapest
--             and most likely fix. If any are MISSING, run
--             server/sql/alter_add_perf_indexes.sql (and the indexes in
--             create_game_events.sql) before anything else.
--   Section 2 shows table sizes so the plans in Section 3 are interpretable.
--   Section 3 is EXPLAIN ANALYZE for the real queries. Fill in the :params
--             with a heavy user's values (see the note in that section) and
--             look for Seq Scans / high-row Nested Loops on game_events or
--             firebase_history.

\timing on

-- =====================================================================
-- SECTION 1 — Are the expected indexes present in THIS database?
-- =====================================================================
-- Expected (from create_game_events.sql + alter_add_perf_indexes.sql / #567):
--   game_events:      game_events_gid_ts_idx, game_events_uid_idx,
--                     game_events_payload_id_idx, game_events_gid_event_type_idx,
--                     game_events_gid_verified_user_idx
--   firebase_history: <primary key (dfac_id, gid)>, idx_firebase_history_gid
--   game_dismissals:  <primary key (user_id, gid)>, game_dismissals_gid_user_idx
--   game_snapshots:   index on gid
--   puzzle_solves:    index on (user_id, pid)
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'game_events', 'firebase_history', 'game_dismissals',
    'game_snapshots', 'puzzle_solves'
  )
ORDER BY tablename, indexname;

-- Quick "is it missing?" checklist — every row should say EXISTS.
SELECT idx AS expected_index,
       CASE WHEN to_regclass('public.' || idx) IS NULL THEN 'MISSING  <-- create it'
            ELSE 'EXISTS' END AS status
FROM (VALUES
  ('game_events_gid_ts_idx'),
  ('game_events_uid_idx'),
  ('game_events_payload_id_idx'),
  ('game_events_gid_event_type_idx'),
  ('game_events_gid_verified_user_idx'),
  ('idx_firebase_history_gid'),
  ('game_dismissals_gid_user_idx')
) AS t(idx);

-- =====================================================================
-- SECTION 2 — Table sizes (context for the plans below)
-- =====================================================================
SELECT relname AS table,
       to_char(reltuples, 'FM999,999,999') AS est_rows,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relname IN (
  'game_events', 'firebase_history', 'game_dismissals',
  'game_snapshots', 'puzzle_solves'
)
ORDER BY pg_total_relation_size(oid) DESC;

-- Find a HEAVY user to test with: the dfac_ids with the most firebase_history
-- rows are the ones whose getUserGamesForPuzzle fans out widest and times out.
SELECT dfac_id, count(*) AS fh_rows
FROM public.firebase_history
GROUP BY dfac_id
ORDER BY fh_rows DESC
LIMIT 10;

-- =====================================================================
-- SECTION 3 — EXPLAIN ANALYZE the real queries
-- =====================================================================
-- Replace the placeholders below with a heavy user's values:
--   :'dfac_ids'  -> a Postgres text array literal, e.g. '{abc123,def456}'
--                   (use the dfac_id(s) from Section 2's heavy-user query;
--                    for an authenticated user, all their linked dfac_ids)
--   :'pid'       -> the puzzle id as text, e.g. '4869'
--   :pid_int     -> the same pid as an integer, e.g. 4869
--   :'user_id'   -> the user's UUID (authenticated path only)
--
-- Pass them on the command line, e.g.:
--   psql -d <db> \
--     -v dfac_ids="{abc123,def456}" -v pid="4869" -v pid_int=4869 \
--     -v user_id="3d96e338-e29b-40fd-bca7-ead7ef7c4142" \
--     -f server/sql/diagnose_user_games_timeout.sql
--
-- Look for: Seq Scan on game_events / firebase_history, or a Nested Loop whose
-- inner side re-scans game_events once per firebase_history row (the OR-in-
-- NOT-EXISTS pathology this change addresses).

-- --- 3a. getUserGamesForPuzzle — GUEST form (dfac_id only, no user_id) ---
-- Mirrors user_games.ts with the NOT EXISTS OR already split (post-fix shape).
EXPLAIN (ANALYZE, BUFFERS)
WITH user_games AS (
  SELECT gid, MAX(ts) AS last_activity, true AS v2, false AS fh_solved
  FROM (
    SELECT gid, ts FROM public.game_events WHERE uid = ANY(:'dfac_ids'::text[])
    UNION ALL
    SELECT gid, ts FROM public.game_events WHERE (event_payload->'params'->>'id') = ANY(:'dfac_ids'::text[])
  ) all_events
  GROUP BY gid

  UNION ALL

  SELECT fh.gid, to_timestamp(fh.activity_time / 1000) AS last_activity, false AS v2, fh.solved AS fh_solved
  FROM public.firebase_history fh
  WHERE fh.dfac_id = ANY(:'dfac_ids'::text[]) AND fh.pid = :pid_int
    AND NOT EXISTS (
      SELECT 1 FROM public.game_events ge WHERE ge.gid = fh.gid AND ge.uid = ANY(:'dfac_ids'::text[])
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.game_events ge WHERE ge.gid = fh.gid AND (ge.event_payload->'params'->>'id') = ANY(:'dfac_ids'::text[])
    )
)
SELECT
  ug.gid,
  COALESCE(ce.event_payload->'params'->>'pid', gs.pid, fh.pid::text) AS pid,
  CASE WHEN gs.gid IS NOT NULL OR ug.fh_solved THEN true ELSE false END AS solved,
  ug.last_activity,
  ug.v2
FROM user_games ug
LEFT JOIN public.game_events ce ON ce.gid = ug.gid AND ce.event_type = 'create'
LEFT JOIN public.game_snapshots gs ON gs.gid = ug.gid
LEFT JOIN LATERAL (
  SELECT pid FROM public.firebase_history WHERE gid = ug.gid AND dfac_id = ANY(:'dfac_ids'::text[]) LIMIT 1
) fh ON true
WHERE COALESCE(ce.event_payload->'params'->>'pid', gs.pid, fh.pid::text) = :'pid'
ORDER BY ug.last_activity DESC;

-- --- 3b. Compare OLD vs NEW legacy branch in isolation ---
-- If Section 3a is still slow, run these two to confirm the split helps.
-- OLD shape (single NOT EXISTS with OR):
EXPLAIN (ANALYZE, BUFFERS)
SELECT fh.gid
FROM public.firebase_history fh
WHERE fh.dfac_id = ANY(:'dfac_ids'::text[]) AND fh.pid = :pid_int
  AND NOT EXISTS (
    SELECT 1 FROM public.game_events ge
    WHERE ge.gid = fh.gid
      AND (ge.uid = ANY(:'dfac_ids'::text[]) OR (ge.event_payload->'params'->>'id') = ANY(:'dfac_ids'::text[]))
  );

-- NEW shape (two NOT EXISTS — what this change ships):
EXPLAIN (ANALYZE, BUFFERS)
SELECT fh.gid
FROM public.firebase_history fh
WHERE fh.dfac_id = ANY(:'dfac_ids'::text[]) AND fh.pid = :pid_int
  AND NOT EXISTS (
    SELECT 1 FROM public.game_events ge WHERE ge.gid = fh.gid AND ge.uid = ANY(:'dfac_ids'::text[])
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.game_events ge WHERE ge.gid = fh.gid AND (ge.event_payload->'params'->>'id') = ANY(:'dfac_ids'::text[])
  );

-- --- 3c. getUserSolveStats core scan (user-stats timeout path) ---
-- The heaviest part of GET /api/user-stats/:id. Requires :'user_id'.
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT ON (ps.pid, CASE WHEN COALESCE(ps.player_count, 1) = 1 THEN 'solo' ELSE 'coop' END)
  ps.pid, ps.time_taken_to_solve
FROM public.puzzle_solves ps
JOIN public.puzzles p ON ps.pid = p.pid
WHERE ps.user_id = :'user_id';

\timing off
