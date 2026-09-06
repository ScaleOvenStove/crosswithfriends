-- Ad-hoc: correct a mistake inside an already-uploaded puzzle.
--
--   psql "$DATABASE_URL" -v pid="'100011842'" -f fix_puzzle_content.sql
--
-- `puzzles.content` is jsonb, so a targeted jsonb_set is enough — there is no
-- update path through the API (server/model/puzzle.ts only ever INSERTs), and
-- getPuzzle() reads the row uncached, so a corrected row is picked up by the
-- next game created from this pid.
--
-- Caveats before you run this:
--   * Games that already exist keep the old data. addInitialGameEvent() copies
--     the grid/solution/clues into the create event (and game_snapshots), so
--     in-progress and solved games are NOT retroactively fixed.
--   * content_hash is the upload dedupe key (sha256 over the JS-canonical
--     {clues, grid} — see computePuzzleHash). It cannot be recomputed
--     faithfully in SQL, so the update below NULLs it. Consequence: a future
--     public upload of the corrected file won't dedupe against this row and
--     will land as a new pid. To keep dedupe working, recompute it in node
--     instead and set it explicitly:
--       node -e 'const c=require("crypto");const p=<content json>;
--         console.log(c.createHash("sha256").update(JSON.stringify(
--           {clues:{across:p.clues.across,down:p.clues.down},grid:p.grid}
--         )).digest("hex"))'
--   * The puzzle list cache (5 min TTL) only holds info + grid dimensions, so
--     grid/clue edits show up immediately; a title/author edit takes up to 5
--     minutes (or a backend restart).

\set ON_ERROR_STOP on

-- 1. Inspect first. grid is [row][col], 0-indexed from the top-left, so the
--    first letter of 1-Across / 1-Down is grid->0->0.
--    Clue arrays are indexed BY CLUE NUMBER (sparse, holes serialize as null),
--    so 8-Down is clues->'down'->8.
SELECT
  pid,
  is_public,
  content->'info'->>'title'   AS title,
  content->'grid'->0->>0      AS cell_0_0,
  content->'clues'->'down'->>8 AS clue_8d
FROM puzzles
WHERE pid = :pid;

-- 2. Apply the fix. Edit the paths/values, then uncomment.
--    Wrapped in a transaction so you can ROLLBACK after re-running the SELECT.
-- BEGIN;
--
-- UPDATE puzzles
-- SET content = jsonb_set(content, '{grid,0,0}', '"S"'::jsonb),
--     content_hash = NULL
-- WHERE pid = :pid;
--
-- -- ...or a clue:
-- -- UPDATE puzzles
-- -- SET content = jsonb_set(content, '{clues,down,8}', to_jsonb('程序 : Program'::text)),
-- --     content_hash = NULL
-- -- WHERE pid = :pid;
--
-- COMMIT;
