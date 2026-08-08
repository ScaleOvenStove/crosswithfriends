-- Fix puzzle titles where the publication name was stamped on repeatedly, e.g.
--
--   "Los Angeles Times Mini: Los Angeles Times Mini: Los Angeles Times Mini: ..."  (x8)
--     -> "Los Angeles Times Mini"
--
-- Keyed on the title pattern rather than on ids: this is a systemic problem
-- from an upload pipeline, and matching the shape catches every affected row
-- including pid 100011104.
--
-- Rewrites info.title in place rather than setting info.titleOverride. An
-- override makes the puzzle list render an "Originally: <ugly title>" subline
-- (see src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.
--
-- Run in pgAdmin. The transaction prints what it will do before it does it.

BEGIN;

-- Collapse one leading copy per pass until no immediate repeat is left, then
-- trim a dangling separator. Keeping capture group 2 (the second copy)
-- preserves the casing of the copy nearest the real title.
--
-- min_copies below is the safety valve: 3 means "only touch titles where the
-- phrase appears 3+ times", which cannot fire on a legitimately doubled title
-- like "Boola Boola". Lower it to 2 if you find real cases with only one
-- duplicate, but re-read the preview first.
CREATE TEMP TABLE title_fix ON COMMIT DROP AS
WITH RECURSIVE min_copies(n) AS (VALUES (3)),
collapse AS (
  SELECT pid,
         content -> 'info' ->> 'title' AS orig,
         regexp_replace(btrim(content -> 'info' ->> 'title'), '\s+', ' ', 'g') AS cur,
         0 AS pass
  FROM puzzles
  WHERE content -> 'info' ->> 'title' ~* '^(\S.*?)\s+(\1)(\s|$)'
  UNION ALL
  SELECT pid, orig,
         regexp_replace(cur, '^(\S.*?)\s+(\1)(\s|$)', '\2\3', 'i'),
         pass + 1
  FROM collapse
  WHERE pass < 30
    AND cur ~* '^(\S.*?)\s+(\1)(\s|$)'
),
final AS (
  SELECT pid, orig, cur, pass
  FROM collapse c
  WHERE pass = (SELECT MAX(pass) FROM collapse c2 WHERE c2.pid = c.pid)
)
SELECT pid,
       orig,
       -- Drop a trailing ":" / "-" left behind when the real title never got
       -- appended. Delete this regexp_replace to keep the separator.
       btrim(regexp_replace(cur, '\s*[:;,\-–—]+\s*$', '')) AS new_title,
       pass + 1 AS copies_found
FROM final
WHERE pass >= (SELECT n FROM min_copies) - 1;

-- PREVIEW. Read this before committing.
SELECT copies_found, orig AS before, new_title AS after
FROM title_fix
ORDER BY copies_found DESC, pid;

-- Apply.
UPDATE puzzles p
SET content = jsonb_set(p.content, '{info,title}', to_jsonb(f.new_title), true)
FROM title_fix f
WHERE p.pid = f.pid
  AND f.new_title <> ''
  AND p.content -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING p.pid, p.content -> 'info' ->> 'title' AS new_title;

-- COMMIT;
-- ROLLBACK;

-- The puzzle list caches server-side for 5 minutes (TTLCache in
-- server/model/puzzle.ts), so the homepage catches up on the next refresh.


-- =====================================================================
-- Existing games keep their own copy of the old title.
-- =====================================================================
-- A game freezes the puzzle's info into its create event when it is made (see
-- getGameInfo in server/model/game.ts), so games already created from these
-- puzzles still render the repeated title. Run this in the SAME transaction,
-- before COMMIT, to fix those too. event_payload is `json`, not `jsonb`, hence
-- the cast round-trip.
--
-- UPDATE game_events ge
-- SET event_payload = jsonb_set(
--       ge.event_payload::jsonb,
--       '{params,game,info,title}',
--       to_jsonb(f.new_title),
--       true
--     )::json
-- FROM title_fix f
-- WHERE ge.event_type = 'create'
--   AND ge.event_payload -> 'params' ->> 'pid' = f.pid
--   AND ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title'
--       IS DISTINCT FROM f.new_title
-- RETURNING ge.gid, ge.event_payload -> 'params' -> 'game' -> 'info' ->> 'title';
