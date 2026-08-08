-- Fix titles where the publication name was stamped on several times instead
-- of once, e.g.
--
--   "Universal Universal Universal Crossword - Aug 8 2026"
--     -> "Universal Crossword - Aug 8 2026"
--
-- Reported in production for 1000011097-104 and 1000011113-4. Those are game
-- ids (gid), not puzzle ids -- the "<number>-<number>" shape comes from
-- getNextGid in src/actions.js -- so the title lives in two places:
--
--   1. puzzles.content -> info -> title
--      The source of truth. Drives the puzzle list and any game created later.
--
--   2. game_events.event_payload -> params -> game -> info -> title
--      A copy frozen into the create event when the game was made (see
--      getGameInfo in server/model/game.ts). This is what these two existing
--      games actually render, so fixing only the puzzle would leave them
--      unchanged.
--
-- Both are rewritten in place rather than via info.titleOverride: an override
-- makes the puzzle list render an "Originally: <ugly title>" subline (see
-- src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.


-- =====================================================================
-- STEP 1 -- Read-only. Confirm the gids resolve and see both titles.
-- =====================================================================

SELECT ge.gid,
       ge.event_payload -> 'params' ->> 'pid'                       AS pid,
       ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title' AS game_title,
       p.content -> 'info' ->> 'title'                              AS puzzle_title,
       p.content -> 'info' ->> 'titleOverride'                      AS puzzle_title_override
FROM game_events ge
LEFT JOIN puzzles p ON p.pid = ge.event_payload -> 'params' ->> 'pid'
WHERE ge.gid IN ('1000011097-104', '1000011113-4')
  AND ge.event_type = 'create';

-- If puzzle_title_override comes back non-NULL, that is what users see for the
-- puzzle, and the first UPDATE below needs '{info,titleOverride}' instead of
-- '{info,title}'.


-- =====================================================================
-- STEP 2 -- The fix. Check the RETURNING output, then COMMIT.
-- =====================================================================

BEGIN;

-- Collapse the repeated leading phrase, one copy per pass, until none is left.
-- Keeping capture group 2 (the second copy) preserves the casing and
-- punctuation of the copy nearest the real title.
CREATE TEMP TABLE title_fix ON COMMIT DROP AS
WITH RECURSIVE targets AS (
  SELECT ge.gid,
         ge.event_payload -> 'params' ->> 'pid'                       AS pid,
         ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title' AS title
  FROM game_events ge
  WHERE ge.gid IN ('1000011097-104', '1000011113-4')
    AND ge.event_type = 'create'
),
collapse AS (
  SELECT gid, pid, regexp_replace(btrim(title), '\s+', ' ', 'g') AS cur, 0 AS pass
  FROM targets
  UNION ALL
  SELECT gid, pid, regexp_replace(cur, '^(\S.*?)\s+(\1)(\s|$)', '\2\3', 'i'), pass + 1
  FROM collapse
  WHERE pass < 10
    AND cur ~* '^(\S.*?)\s+(\1)(\s|$)'
)
SELECT gid, pid, cur AS new_title
FROM collapse c
WHERE pass = (SELECT MAX(pass) FROM collapse c2 WHERE c2.gid = c.gid);

-- Look at this before going further. If new_title is unchanged or wrong, skip
-- to the fallback below and ROLLBACK.
SELECT * FROM title_fix;

-- 1. The puzzle.
UPDATE puzzles p
SET content = jsonb_set(p.content, '{info,title}', to_jsonb(f.new_title), true)
FROM title_fix f
WHERE p.pid = f.pid
  AND p.content -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING p.pid, p.content -> 'info' ->> 'title' AS puzzle_title;

-- 2. The frozen copy in each game's create event. event_payload is `json`,
-- not `jsonb`, hence the cast round-trip.
UPDATE game_events ge
SET event_payload = jsonb_set(
      ge.event_payload::jsonb,
      '{params,game,info,title}',
      to_jsonb(f.new_title),
      true
    )::json
FROM title_fix f
WHERE ge.gid = f.gid
  AND ge.event_type = 'create'
  AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title' AS game_title;

-- COMMIT;
-- ROLLBACK;

-- The puzzle list caches server-side for 5 minutes (TTLCache in
-- server/model/puzzle.ts), so the homepage catches up on the next refresh.
--
-- Other games already created from the same puzzles keep their own frozen
-- copy of the old title. To fix those too, drop the `ge.gid = f.gid` condition
-- in UPDATE 2 and match on the pid instead:
--   WHERE ge.event_type = 'create'
--     AND ge.event_payload -> 'params' ->> 'pid' = f.pid


-- =====================================================================
-- Fallback -- set the titles by hand.
-- =====================================================================
-- The regex only collapses copies separated by whitespace alone. If a title is
-- shaped differently -- "Newsday, Newsday Crossword", or the publication
-- repeating at the end -- the UPDATEs above match nothing. Paste the corrected
-- titles here instead, using the pid from STEP 1.
--
-- BEGIN;
--
-- UPDATE puzzles
-- SET content = jsonb_set(content, '{info,title}', to_jsonb('PASTE TITLE'::text), true)
-- WHERE pid = 'PASTE PID'
-- RETURNING pid, content -> 'info' ->> 'title';
--
-- UPDATE game_events
-- SET event_payload = jsonb_set(
--       event_payload::jsonb, '{params,game,info,title}', to_jsonb('PASTE TITLE'::text), true
--     )::json
-- WHERE gid = '1000011097-104' AND event_type = 'create'
-- RETURNING gid, event_payload -> 'params' -> 'game' -> 'info' ->> 'title';
--
-- COMMIT;
