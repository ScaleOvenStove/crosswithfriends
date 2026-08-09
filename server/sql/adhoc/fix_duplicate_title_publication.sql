-- Collapse publication/date headers that an upload pipeline stamped onto
-- puzzle titles repeatedly, e.g.
--
--   "Los Angeles Times Mini: Los Angeles Times Mini: ... August 05, 2026"  (x8)
--     -> "Los Angeles Times Mini: August 05, 2026"
--
-- Scoped to an explicit pid list -- the 23 affected puzzles, identified from a
-- production dump of every title containing a repeated leading phrase. The new
-- title is still computed by regex so nobody hand-types 23 strings, but the
-- pid list bounds the blast radius. This matters because most repeated titles
-- are INTENTIONAL wordplay -- "Knock Knock", "Location, Location, Location",
-- "Teacher! Teacher! - Thursday, May 14, 2026" -- and none are in the list.
--
-- Split into two steps because they have very different costs:
--
--   STEP 1  puzzles           23 rows by primary key. Instant.
--   STEP 2  game_events       Sequential scan. Needs a raised statement_timeout.
--
-- Run STEP 1 and commit it first; it fixes the puzzle list on its own and
-- there is no reason to hold it hostage to STEP 2.
--
-- Titles are rewritten in place rather than via info.titleOverride: an
-- override makes the puzzle list render an "Originally: <ugly title>" subline
-- (see src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.


-- =====================================================================
-- STEP 1 -- The puzzles. Fast.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE title_fix AS
WITH RECURSIVE affected(pid) AS (VALUES
  -- Los Angeles Times Mini, x8
  ('100011097'), ('100011098'), ('100011099'), ('100011100'),
  ('100011101'), ('100011102'), ('100011103'), ('100011104'),
  -- Los Angeles Times Mini, x2
  ('100010102'), ('100010106'), ('100010245'), ('100010249'),
  -- Atlantic, x8
  ('100011113'), ('100011114'),
  -- Atlantic, x2
  ('100010104'), ('100010108'), ('100010247'), ('100010251'),
  -- Newsday Wednesday, x2
  ('100011106'), ('100011112'),
  -- one-offs
  ('100008758'),  -- Vulture Midi Tuesday, May 26, 2026
  ('49879'),      -- Thursday, Oct 02, 2025
  ('51366')       -- USA Today Friday, Oct 31, 2025
),
collapse AS (
  SELECT p.pid,
         p.content -> 'info' ->> 'title' AS orig,
         regexp_replace(btrim(p.content -> 'info' ->> 'title'), '\s+', ' ', 'g') AS cur,
         0 AS pass
  FROM puzzles p
  JOIN affected a ON a.pid = p.pid
  UNION ALL
  -- Strip one leading copy per pass. Keeping capture group 2 (the second
  -- copy) preserves the punctuation of the copy nearest the real title.
  -- Case-sensitive: these headers repeat verbatim.
  SELECT pid, orig, regexp_replace(cur, '^(\S.*?)\s+(\1)(\s|$)', '\2\3'), pass + 1
  FROM collapse
  WHERE pass < 30
    AND cur ~ '^(\S.*?)\s+\1(\s|$)'
)
SELECT pid, orig, cur AS new_title, pass + 1 AS copies_found
FROM collapse c
WHERE pass = (SELECT MAX(pass) FROM collapse c2 WHERE c2.pid = c.pid);

-- NOTE: no ON COMMIT DROP -- STEP 2 reuses this table. It lives for the rest
-- of the pgAdmin session and disappears when the connection closes.

-- PREVIEW. Expect 23 rows.
SELECT copies_found, orig AS before, new_title AS after
FROM title_fix
ORDER BY copies_found DESC, pid;

UPDATE puzzles p
SET content = jsonb_set(p.content, '{info,title}', to_jsonb(f.new_title), true)
FROM title_fix f
WHERE p.pid = f.pid
  AND f.new_title <> ''
  AND p.content -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING p.pid, p.content -> 'info' ->> 'title' AS new_title;

COMMIT;

-- The puzzle list caches server-side for 5 minutes (TTLCache in
-- server/model/puzzle.ts), so the homepage catches up on the next refresh.


-- =====================================================================
-- STEP 2 -- Existing games. Slow: needs a raised timeout.
-- =====================================================================
-- A game freezes the puzzle's info into its create event when it is made (see
-- getGameInfo in server/model/game.ts), so in-progress and finished games
-- render their own stale copy and STEP 1 does not touch them.
--
-- game_events has indexes on gid, uid, params->>'id' and (gid, event_type) --
-- but nothing on params->>'pid'. Matching on pid therefore sequentially scans
-- the whole table, which is what trips a 30s statement_timeout. The write
-- itself is tiny; the scan is the entire cost.
--
-- SET LOCAL applies only to this transaction and reverts on COMMIT.

BEGIN;

SET LOCAL statement_timeout = '10min';

UPDATE game_events ge
SET event_payload = jsonb_set(
      ge.event_payload::jsonb,
      '{params,game,info,title}',
      to_jsonb(f.new_title),
      true
    )::json
FROM title_fix f
WHERE ge.event_type = 'create'
  AND ge.event_payload -> 'params' ->> 'pid' = f.pid
  AND f.new_title <> ''
  AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title'
      IS DISTINCT FROM f.new_title
RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title' AS new_title;

COMMIT;

-- Open games read the create event on join, so a reload picks up the title.


-- =====================================================================
-- STEP 2, alternative -- if the timeout cannot be raised
-- =====================================================================
-- Resolves pid -> gid through game_snapshots (indexed on pid) and
-- puzzle_solves (indexed, and pid is its FK), then hits game_events by
-- (gid, event_type), which IS indexed. No sequential scan, runs in
-- milliseconds.
--
-- The catch: both those tables only carry FINISHED games. In-progress games
-- appear in neither, so this silently misses exactly the games most likely to
-- be looked at. Use it only as a partial fix.
--
-- BEGIN;
--
-- WITH gids AS (
--   SELECT gs.gid, f.new_title
--     FROM game_snapshots gs JOIN title_fix f ON f.pid = gs.pid
--   UNION
--   SELECT ps.gid, f.new_title
--     FROM puzzle_solves ps JOIN title_fix f ON f.pid = ps.pid
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
-- Cleanup
-- =====================================================================
-- DROP TABLE IF EXISTS title_fix;


-- =====================================================================
-- The pipeline is still producing these
-- =====================================================================
-- Affected dates run through August 2026, so more will accumulate. To list new
-- ones later, key on the shape of the repeated unit -- ends in a colon, or
-- contains a 4-digit year -- which separates a publication header from
-- wordplay. "Teacher! Teacher! - Thursday, May 14, 2026" is correctly excluded
-- because its year falls outside the repeated unit.
--
-- SELECT pid, content -> 'info' ->> 'title' AS title
-- FROM puzzles
-- WHERE content -> 'info' ->> 'title' ~ '^(\S.*?)\s+\1(\s|$)'
--   AND (
--     substring(regexp_replace(btrim(content -> 'info' ->> 'title'), '\s+', ' ', 'g')
--               from '^(\S.*?)\s+\1(?:\s|$)') ~ ':$'
--     OR substring(regexp_replace(btrim(content -> 'info' ->> 'title'), '\s+', ' ', 'g')
--               from '^(\S.*?)\s+\1(?:\s|$)') ~ '\d{4}'
--   )
-- ORDER BY pid;
