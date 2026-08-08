-- Collapse publication/date headers that an upload pipeline stamped onto
-- puzzle titles repeatedly, e.g.
--
--   "Los Angeles Times Mini: Los Angeles Times Mini: ... August 05, 2026"  (x8)
--     -> "Los Angeles Times Mini: August 05, 2026"
--   "Atlantic: Atlantic: Friday, June 26, 2026"
--     -> "Atlantic: Friday, June 26, 2026"
--
-- The hard part is that most repeated titles are INTENTIONAL wordplay --
-- "Knock Knock", "Location, Location, Location", "Turn! Turn! Turn!",
-- "Teacher! Teacher! - Thursday, May 14, 2026" -- and must not be touched.
--
-- Two guards separate the two cases. Both are applied to the repeated unit
-- itself, not to the whole title:
--
--   1. The unit ends in a colon        -- "Los Angeles Times Mini:",
--                                         "Atlantic:", "Newsday Wednesday:"
--   2. The unit contains a 4-digit year -- "Thursday, Oct 02, 2025",
--                                         "USA Today Friday, Oct 31, 2025",
--                                         "Vulture Midi Tuesday, May 26, 2026"
--
-- No legitimate wordplay title in production satisfies either: they end in
-- "!", ",", "?", "." or nothing, and none carries a year. Note that
-- "Teacher! Teacher! - Thursday, May 14, 2026" is correctly skipped -- the
-- year is outside the repeated unit.
--
-- Matching is case-SENSITIVE on purpose. Pipeline headers repeat verbatim,
-- while case-varying wordplay ("Mini mini", "Love, love, love", "Row, row,
-- row") is excluded for free.
--
-- Rewrites info.title in place rather than setting info.titleOverride: an
-- override makes the puzzle list render an "Originally: <ugly title>" subline
-- (see src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.

BEGIN;

CREATE TEMP TABLE title_fix ON COMMIT DROP AS
WITH RECURSIVE candidates AS (
  SELECT pid,
         content -> 'info' ->> 'title' AS orig,
         regexp_replace(btrim(content -> 'info' ->> 'title'), '\s+', ' ', 'g') AS norm
  FROM puzzles
  WHERE content -> 'info' ->> 'title' ~ '^(\S.*?)\s+\1(\s|$)'
),
guarded AS (
  SELECT pid, orig, norm
  FROM candidates
  WHERE substring(norm from '^(\S.*?)\s+\1(?:\s|$)') ~ ':$'
     OR substring(norm from '^(\S.*?)\s+\1(?:\s|$)') ~ '\d{4}'
),
collapse AS (
  SELECT pid, orig, norm AS cur, 0 AS pass FROM guarded
  UNION ALL
  -- Strip one leading copy per pass. Keeping capture group 2 (the second
  -- copy) preserves the punctuation of the copy nearest the real title.
  SELECT pid, orig, regexp_replace(cur, '^(\S.*?)\s+(\1)(\s|$)', '\2\3'), pass + 1
  FROM collapse
  WHERE pass < 30
    AND cur ~ '^(\S.*?)\s+\1(\s|$)'
)
SELECT pid, orig, cur AS new_title, pass + 1 AS copies_found
FROM collapse c
WHERE pass = (SELECT MAX(pass) FROM collapse c2 WHERE c2.pid = c.pid);

-- PREVIEW. Every row here should be a publication or date header, never
-- wordplay. Read it before committing.
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
-- before COMMIT. event_payload is `json`, not `jsonb`, hence the cast
-- round-trip.
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


-- =====================================================================
-- Not covered
-- =====================================================================
-- A repeated header with neither a colon nor a year -- "USA Today USA Today
-- Crossword" -- fails both guards and is left alone. None exist in the
-- current data. If some show up later, fix them by pid rather than loosening
-- the guards, which is what protects the wordplay titles.
--
-- Separately, the "[?] [?] ..." titles in this list are a different bug: a
-- source pipeline that replaced card suits and emoji with literal "[?]".
-- See BROKEN_PLACEHOLDER in server/model/puzzle.ts. Not addressed here.
