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

DELETE FROM game_snapshots WHERE gid LIKE 'e2e-%';
DELETE FROM puzzle_solves WHERE pid LIKE 'e2e-%' OR gid LIKE 'e2e-%';
DELETE FROM game_events WHERE gid LIKE 'e2e-%';
DELETE FROM puzzle_ratings WHERE pid LIKE 'e2e-%';
DELETE FROM puzzles WHERE pid LIKE 'e2e-%';

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
