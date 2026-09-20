-- Deterministic puzzle for the Playwright suite.
--
-- loadtest/seed.sql generates puzzles with RANDOM grids but a fixed set of
-- clues (numbers 1-3 only). Clue numbers are derived from grid geometry at
-- render time (GridWrapper.assignNumbers), not from the stored clue keys, so a
-- random 5x5 numbers its entries 1..9 and everything above 3 renders with no
-- clue at all. That is fine for load tests, which only care about query shape,
-- but it makes the UI specs depend on whatever the seed happened to roll —
-- "selected clue follows grid cell selection" passed locally and failed in CI
-- on the same commit for exactly that reason.
--
-- This puzzle is a 5x5 with no black squares, so the numbering is fixed:
--   across: 1, 6, 7, 8, 9      down: 1, 2, 3, 4, 5
-- The answers form a double word square (the grid equals its own transpose),
-- so the across and down answers match and the clues stay consistent.
--
--   H E A R T
--   E M B E R
--   A B U S E
--   R E S I N
--   T R E N D
--
-- Clues are sparse arrays indexed by clue number, matching CluesJson.

-- Step 1: the fixture itself. Everything here is keyed on pid, which is either
-- the primary key or an indexed column, so it cannot be slow.
--
-- This runs BEFORE the housekeeping below, in its own transaction, and that
-- ordering is the whole point. The first version put a reverse lookup over
-- game_events in the same transaction as this INSERT; on the testing database
-- that scan hit the 30s statement_timeout, which aborted the transaction and
-- rolled the INSERT back with it. The fixture was silently absent and six
-- Playwright specs failed. Nothing that is merely nice to have may sit between
-- this INSERT and its COMMIT.
BEGIN;

DELETE FROM game_snapshots WHERE pid = 'e2e-mini-1';
DELETE FROM puzzle_ratings WHERE pid = 'e2e-mini-1';
-- puzzle_solves.pid is ON DELETE CASCADE, so this clears those too.
DELETE FROM puzzles WHERE pid = 'e2e-mini-1';

INSERT INTO puzzles (pid, is_public, uploaded_at, content, uploaded_by, content_hash)
VALUES (
  'e2e-mini-1',
  true,
  NOW(),
  jsonb_build_object(
    'grid', jsonb_build_array(
      jsonb_build_array('H', 'E', 'A', 'R', 'T'),
      jsonb_build_array('E', 'M', 'B', 'E', 'R'),
      jsonb_build_array('A', 'B', 'U', 'S', 'E'),
      jsonb_build_array('R', 'E', 'S', 'I', 'N'),
      jsonb_build_array('T', 'R', 'E', 'N', 'D')
    ),
    'solution', jsonb_build_array(
      jsonb_build_array('H', 'E', 'A', 'R', 'T'),
      jsonb_build_array('E', 'M', 'B', 'E', 'R'),
      jsonb_build_array('A', 'B', 'U', 'S', 'E'),
      jsonb_build_array('R', 'E', 'S', 'I', 'N'),
      jsonb_build_array('T', 'R', 'E', 'N', 'D')
    ),
    -- Index 0 is unused; nulls pad the gaps so each clue sits at its number.
    'clues', jsonb_build_object(
      'across', jsonb_build_array(
        null,
        'Organ that pumps blood',
        null, null, null, null,
        'Glowing coal fragment',
        'Mistreat',
        'Pine secretion',
        'General direction of change'
      ),
      'down', jsonb_build_array(
        null,
        'Organ that pumps blood',
        'Glowing coal fragment',
        'Mistreat',
        'Pine secretion',
        'General direction of change'
      )
    ),
    'info', jsonb_build_object(
      'title', 'E2E Fixture Mini',
      'author', 'E2E Suite',
      'type', 'Mini',
      'description', 'Deterministic puzzle used by the Playwright suite. Do not edit casually.'
    ),
    'circles', '[]'::jsonb,
    'shades', '[]'::jsonb
  ),
  NULL,
  'e2e-fixture-mini-1'
);

COMMIT;

-- Step 2: best-effort housekeeping, deliberately after the commit above.
--
-- Games the suite creates do NOT get an e2e-prefixed gid: Play.create() mints
-- `<counter>-<word>` (e.g. 100002001-thrump), so the only thing tying a game
-- back to this puzzle is its create event. Every index on game_events is
-- gid-leading, so that lookup is a full scan with a JSON extraction per row and
-- there is no index that would make it reliably fast.
--
-- So it is bounded and disposable: its own transaction, its own short timeout.
-- If it times out or blocks on a lock, this transaction rolls back alone, the
-- fixture from step 1 is already committed, and the suite runs regardless. The
-- events it failed to collect are picked up by the next run.
BEGIN;

SET LOCAL statement_timeout = '10s';

CREATE TEMP TABLE e2e_gids ON COMMIT DROP AS
SELECT DISTINCT gid
FROM game_events
WHERE event_type = 'create'
  AND event_payload -> 'params' ->> 'pid' = 'e2e-mini-1';

DELETE FROM game_snapshots WHERE gid IN (SELECT gid FROM e2e_gids);
DELETE FROM puzzle_solves WHERE gid IN (SELECT gid FROM e2e_gids);
DELETE FROM game_dismissals WHERE gid IN (SELECT gid FROM e2e_gids);
DELETE FROM game_events WHERE gid IN (SELECT gid FROM e2e_gids);

COMMIT;
