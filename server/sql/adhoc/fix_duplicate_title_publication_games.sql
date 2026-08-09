-- STEP 2 of the duplicate-title cleanup: the games.
-- See fix_duplicate_title_publication.sql for STEP 1 (the puzzles), which is
-- 23 rows by primary key and runs instantly. This file is only about
-- game_events, which is where the statement_timeout hits.
--
-- WHY IT IS SLOW
--
-- A game freezes the puzzle's info into its create event (getGameInfo,
-- server/model/game.ts), so existing games render their own stale copy.
-- Matching those events means testing event_payload->'params'->>'pid', and
-- game_events has no index on that expression -- only gid, uid,
-- params->>'id', and (gid, event_type). So the UPDATE sequentially scans the
-- table, and for every create row it must detoast the whole payload (which
-- carries the full grid, clues and solution) just to read one string. That is
-- the 10+ minutes.
--
-- This is not an oversight in the schema: the app never looks up games by pid
-- globally. getUserGamesForPuzzle (server/model/user_games.ts) always starts
-- from one user's gids via the uid / params->>'id' indexes and filters by pid
-- afterwards, so nothing in normal operation needs this access path.
--
-- Pick ONE of the options below.


-- =====================================================================
-- FIRST -- size the problem. Instant, reads catalog only.
-- =====================================================================

SELECT reltuples::bigint AS approx_total_events,
       pg_size_pretty(pg_total_relation_size('game_events')) AS total_size,
       pg_size_pretty(pg_relation_size('game_events')) AS heap_only
FROM pg_class
WHERE relname = 'game_events';


-- =====================================================================
-- OPTION A -- do nothing. Genuinely defensible.
-- =====================================================================
-- STEP 1 already fixed the puzzle list, which is where these titles are
-- actually browsed. Only games ALREADY created from these 23 puzzles keep the
-- repeated title, and any new game picks up the corrected one. If nobody is
-- looking at those old games, this costs nothing to skip.


-- =====================================================================
-- OPTION B -- fix specific games by gid. Instant.
-- =====================================================================
-- Uses game_events_gid_event_type_idx, so it is an index scan regardless of
-- table size. Best when you only care about a handful of games someone
-- actually reported.

-- BEGIN;
--
-- UPDATE game_events ge
-- SET event_payload = jsonb_set(
--       ge.event_payload::jsonb, '{params,game,info,title}', to_jsonb(f.new_title), true
--     )::json
-- FROM title_fix f
-- WHERE ge.gid IN ('1000011097-104', '1000011113-4')   -- <-- the gids you care about
--   AND ge.event_type = 'create'
--   AND ge.event_payload -> 'params' ->> 'pid' = f.pid
--   AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title'
--       IS DISTINCT FROM f.new_title
-- RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title';
--
-- COMMIT;


-- =====================================================================
-- OPTION C -- fix all FINISHED games. Instant, but incomplete.
-- =====================================================================
-- Resolves pid -> gid through game_snapshots (indexed on pid) and
-- puzzle_solves (pid is its FK), then hits game_events by (gid, event_type).
-- No scan.
--
-- The catch: both tables only carry finished games. In-progress games appear
-- in neither and are silently skipped -- verified by test. Those are arguably
-- the ones most likely to be looked at, so treat this as a partial fix.

-- BEGIN;
--
-- WITH gids AS (
--   SELECT gs.gid, f.new_title FROM game_snapshots gs JOIN title_fix f ON f.pid = gs.pid
--   UNION
--   SELECT ps.gid, f.new_title FROM puzzle_solves ps JOIN title_fix f ON f.pid = ps.pid
-- )
-- UPDATE game_events ge
-- SET event_payload = jsonb_set(
--       ge.event_payload::jsonb, '{params,game,info,title}', to_jsonb(g.new_title), true
--     )::json
-- FROM gids g
-- WHERE ge.gid = g.gid
--   AND ge.event_type = 'create'
--   AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title'
--       IS DISTINCT FROM g.new_title
-- RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title';
--
-- COMMIT;


-- =====================================================================
-- OPTION D -- complete fix: build the index, then update. Recommended.
-- =====================================================================
-- The full pass over create events is unavoidable, but it does not have to
-- happen inside a statement that a timeout can kill. Pay it once as a
-- CONCURRENTLY index build, which does not block reads or writes on this
-- high-write table, then the UPDATE becomes an index scan.
--
-- Verified plan with the index in place:
--   Index Scan using game_events_create_pid_idx
--     Index Cond: (((event_payload -> 'params') ->> 'pid') = '100011104')
--
-- D1. Run in pgAdmin with auto-commit ON. CREATE INDEX CONCURRENTLY cannot
--     run inside a transaction block -- do NOT wrap this in BEGIN. The build
--     takes roughly as long as the scan that was timing out, but it will not
--     be killed and nothing is blocked while it runs.

-- SET statement_timeout = 0;
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS game_events_create_pid_idx
--   ON public.game_events ((event_payload -> 'params' ->> 'pid'))
--   WHERE event_type = 'create';

-- D2. Confirm it built cleanly. An interrupted CONCURRENTLY build leaves an
--     INVALID index behind that is never used; if indisvalid is false, drop
--     it and retry D1.
--
-- SELECT indexrelid::regclass AS index, indisvalid
-- FROM pg_index
-- WHERE indexrelid = 'game_events_create_pid_idx'::regclass;

-- D3. Now the UPDATE is fast.
--
-- BEGIN;
--
-- UPDATE game_events ge
-- SET event_payload = jsonb_set(
--       ge.event_payload::jsonb, '{params,game,info,title}', to_jsonb(f.new_title), true
--     )::json
-- FROM title_fix f
-- WHERE ge.event_type = 'create'
--   AND ge.event_payload -> 'params' ->> 'pid' = f.pid
--   AND f.new_title <> ''
--   AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title'
--       IS DISTINCT FROM f.new_title
-- RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title';
--
-- COMMIT;

-- D4. Drop the index, or keep it. The upload pipeline is still producing
--     these titles, so if this cleanup will recur it is worth keeping -- at
--     the cost of extra work on every create-event insert. Partial on
--     event_type = 'create' keeps it small: one entry per game, not per event.
--
-- DROP INDEX CONCURRENTLY IF EXISTS game_events_create_pid_idx;
