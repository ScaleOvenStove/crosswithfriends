-- Diagnostic queries for finding and cleaning up orphaned game data.
-- These are NOT meant to be run automatically — use them manually when debugging
-- "Game not found" errors or stale data issues.

-- 1. Find games that have events but no 'create' event (orphaned games)
SELECT ge.gid, COUNT(*) AS event_count, MIN(ge.ts) AS first_event, MAX(ge.ts) AS last_event
FROM game_events ge
WHERE NOT EXISTS (
  SELECT 1 FROM game_events ce WHERE ce.gid = ge.gid AND ce.event_type = 'create'
)
GROUP BY ge.gid
ORDER BY last_event DESC;

-- 2. Find games whose 'create' event references a puzzle that no longer exists
SELECT ge.gid, ge.event_payload->'params'->>'pid' AS pid, ge.ts
FROM game_events ge
WHERE ge.event_type = 'create'
  AND NOT EXISTS (
    SELECT 1 FROM puzzles p WHERE p.pid = ge.event_payload->'params'->>'pid'
  )
ORDER BY ge.ts DESC;

-- 3. Delete all events for a specific orphaned game (replace $GID)
-- DELETE FROM game_events WHERE gid = '$GID';

-- 4. Delete all events for games referencing non-existent puzzles
-- DELETE FROM game_events ge
-- WHERE ge.event_type = 'create'
--   AND NOT EXISTS (
--     SELECT 1 FROM puzzles p WHERE p.pid = ge.event_payload->'params'->>'pid'
--   );
