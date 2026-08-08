-- Fix puzzle titles where the publication name was stamped on several times
-- instead of once, e.g.
--
--   "Universal Universal Universal Crossword - Aug 8 2026"
--     -> "Universal Crossword - Aug 8 2026"
--
-- Reported in production for pids 1000011097-104 and 1000011113-4.
--
-- Rewrites info.title in place rather than setting info.titleOverride: an
-- override makes the puzzle list render an "Originally: <ugly title>" subline
-- (see src/components/PuzzleList/Entry.tsx), which is wrong for a typo fix.
--
-- Run in pgAdmin, check the RETURNING output, then COMMIT (or ROLLBACK).

BEGIN;

WITH RECURSIVE targets AS (
  SELECT pid, content -> 'info' ->> 'title' AS title
  FROM puzzles
  WHERE pid IN ('1000011097-104', '1000011113-4')
),
collapse AS (
  SELECT pid,
         regexp_replace(btrim(title), '\s+', ' ', 'g') AS cur,
         0 AS pass
  FROM targets
  UNION ALL
  -- Strip one leading copy per pass until no immediate repeat is left.
  -- Keeping group 2 (the second copy) preserves the casing and punctuation
  -- of the copy nearest the real title.
  SELECT pid,
         regexp_replace(cur, '^(\S.*?)\s+(\1)(\s|$)', '\2\3', 'i'),
         pass + 1
  FROM collapse
  WHERE pass < 10
    AND cur ~* '^(\S.*?)\s+(\1)(\s|$)'
),
fixed AS (
  SELECT pid, cur AS new_title
  FROM collapse c
  WHERE pass = (SELECT MAX(pass) FROM collapse c2 WHERE c2.pid = c.pid)
)
UPDATE puzzles p
SET content = jsonb_set(p.content, '{info,title}', to_jsonb(f.new_title), true)
FROM fixed f
WHERE p.pid = f.pid
  AND p.content -> 'info' ->> 'title' IS DISTINCT FROM f.new_title
RETURNING p.pid,
          f.new_title;

-- COMMIT;
-- ROLLBACK;

-- The puzzle list caches server-side for 5 minutes (TTLCache in
-- server/model/puzzle.ts), so the homepage catches up on the next refresh.


-- ---------------------------------------------------------------------
-- Fallback: set the titles by hand.
-- ---------------------------------------------------------------------
-- The regex only collapses copies separated by whitespace alone. If a title
-- is shaped differently — "Newsday, Newsday Crossword", or the publication
-- repeating at the end — the UPDATE above leaves it alone. Paste the
-- corrected titles here instead.
--
-- BEGIN;
--
-- UPDATE puzzles
-- SET content = jsonb_set(content, '{info,title}', to_jsonb('PASTE TITLE'::text), true)
-- WHERE pid = '1000011097-104'
-- RETURNING pid, content -> 'info' ->> 'title';
--
-- UPDATE puzzles
-- SET content = jsonb_set(content, '{info,title}', to_jsonb('PASTE TITLE'::text), true)
-- WHERE pid = '1000011113-4'
-- RETURNING pid, content -> 'info' ->> 'title';
--
-- COMMIT;
