-- Collapse publication/date headers that an upload pipeline stamped onto
-- puzzle titles repeatedly, e.g.
--
--   "Los Angeles Times Mini: Los Angeles Times Mini: ... August 05, 2026"  (x8)
--     -> "Los Angeles Times Mini: August 05, 2026"
--
-- Scoped to an explicit pid list -- the 23 affected puzzles, identified from a
-- production dump of every title containing a repeated leading phrase. The new
-- title is still computed by regex so nobody has to hand-type 23 strings, but
-- the pid list bounds the blast radius: nothing outside it can be touched.
--
-- This matters because most repeated titles are INTENTIONAL wordplay --
-- "Knock Knock", "Location, Location, Location", "Turn! Turn! Turn!",
-- "Teacher! Teacher! - Thursday, May 14, 2026" -- and none of them are here.
--
-- Two things get updated, both in one transaction:
--   1. puzzles.content -> info -> title
--        The source of truth. Drives the puzzle list.
--   2. game_events create payload -> params -> game -> info -> title
--        A game freezes the puzzle's info when it is created (see getGameInfo
--        in server/model/game.ts), so in-progress and finished games render
--        their own stale copy. Skipping this leaves every existing game
--        looking exactly as broken as before.
--
-- Titles are rewritten in place rather than via info.titleOverride: an
-- override makes the puzzle list render an "Originally: <ugly title>" subline
-- (see src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.

BEGIN;

CREATE TEMP TABLE title_fix ON COMMIT DROP AS
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

-- PREVIEW. Expect 23 rows, every "after" a single header plus the real title.
SELECT copies_found, orig AS before, new_title AS after
FROM title_fix
ORDER BY copies_found DESC, pid;

-- Any pid that did not resolve, or that the regex left unchanged. Expect none.
SELECT a.pid AS unresolved_or_unchanged
FROM (VALUES
  ('100011097'), ('100011098'), ('100011099'), ('100011100'),
  ('100011101'), ('100011102'), ('100011103'), ('100011104'),
  ('100010102'), ('100010106'), ('100010245'), ('100010249'),
  ('100011113'), ('100011114'),
  ('100010104'), ('100010108'), ('100010247'), ('100010251'),
  ('100011106'), ('100011112'),
  ('100008758'), ('49879'), ('51366')
) a(pid)
LEFT JOIN title_fix f ON f.pid = a.pid AND f.new_title <> f.orig
WHERE f.pid IS NULL;

-- 1. The puzzles.
UPDATE puzzles p
SET content = jsonb_set(p.content, '{info,title}', to_jsonb(f.new_title), true)
FROM title_fix f
WHERE p.pid = f.pid
  AND f.new_title <> ''
  AND p.content -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING p.pid, p.content -> 'info' ->> 'title' AS new_title;

-- 2. Every existing game built from those puzzles, in-progress or finished.
-- event_payload is `json`, not `jsonb`, hence the cast round-trip.
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

-- COMMIT;
-- ROLLBACK;

-- The puzzle list caches server-side for 5 minutes (TTLCache in
-- server/model/puzzle.ts), so the homepage catches up on the next refresh.
-- Open games read the create event on join, so a reload picks up the new title.


-- =====================================================================
-- The pipeline is still producing these
-- =====================================================================
-- The affected dates run through August 2026, so whatever uploads these will
-- keep adding more. To list new ones later, run the guarded scan below: it
-- keys on the shape of the repeated unit -- ends in a colon, or contains a
-- 4-digit year -- which is what separates a publication header from wordplay.
-- "Teacher! Teacher! - Thursday, May 14, 2026" is correctly excluded, since
-- its year falls outside the repeated unit.
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
