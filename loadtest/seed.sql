-- Seed script for load testing: generates production-scale test data.
--
-- Safe to re-run — cleans up previous load test data before inserting.
--
-- Usage:
--   psql -d <dbname> -f loadtest/seed.sql
--
-- Generates:
--   ~200 users
--   ~500 puzzles (with realistic JSONB content for trigram search)
--   ~2000 games with ~20K game_events
--   ~1500 puzzle_solves
--   ~1000 game_snapshots
--
-- This is enough data for the heavy queries (puzzle_list filtering,
-- game_events replay, puzzle_solves aggregation) to behave like production.
--
-- This script is idempotent: it cleans up any existing load test data
-- before re-inserting, so it's safe to run multiple times.

BEGIN;

-- ============================================================
-- 0. CLEANUP previous load test data (order matters for FK constraints)
-- ============================================================
DELETE FROM game_snapshots WHERE gid LIKE 'lt-%';
DELETE FROM puzzle_solves WHERE gid LIKE 'lt-%';
DELETE FROM game_events WHERE gid LIKE 'lt-%';
DELETE FROM puzzles WHERE pid LIKE 'lt-%';
DELETE FROM users WHERE email LIKE 'loadtest_%@test.example.com';

-- ============================================================
-- 1. USERS (~200)
-- ============================================================
INSERT INTO users (id, email, password_hash, display_name, auth_provider, profile_is_public)
SELECT
  gen_random_uuid(),
  'loadtest_user_' || i || '@test.example.com',
  -- pre-computed bcrypt hash of 'password123' (saves CPU vs hashing 200 times)
  '$2b$12$8TtelLZGrSsuhpkYDXj55uG5TWfrWe6N.K0MnKb.bIVmgOWUdC8x.',
  'Test User ' || i,
  CASE WHEN i % 10 = 0 THEN 'google' ELSE 'local' END,
  i % 3 = 0  -- ~33% public profiles
FROM generate_series(1, 200) AS i;

-- ============================================================
-- 2. PUZZLES (~500 with realistic content)
-- ============================================================

-- Mini puzzles (5x5) — ~200
INSERT INTO puzzles (pid, is_public, uploaded_at, content, uploaded_by, content_hash)
SELECT
  'lt-mini-' || i,
  false,
  NOW() - (random() * interval '365 days'),
  jsonb_build_object(
    'grid', (SELECT jsonb_agg(
      (SELECT jsonb_agg(
        CASE WHEN random() < 0.15 THEN '.'
             ELSE chr(65 + floor(random() * 26)::int)
        END
      ) FROM generate_series(1, 5))
    ) FROM generate_series(1, 5)),
    'clues', jsonb_build_object(
      'across', jsonb_build_object(
        '1', 'Across clue ' || i || ' for mini puzzle',
        '2', 'Another across clue for testing search',
        '3', 'Third clue with keyword NYT mini'
      ),
      'down', jsonb_build_object(
        '1', 'Down clue ' || i || ' for mini puzzle',
        '2', 'Another down clue for testing',
        '3', 'Third down clue with keyword crossword'
      )
    ),
    'info', jsonb_build_object(
      'title', CASE
        WHEN i % 5 = 0 THEN 'NYT Mini Crossword #' || i
        WHEN i % 5 = 1 THEN 'Daily Mini Puzzle ' || i
        WHEN i % 5 = 2 THEN 'Quick Crossword ' || i
        WHEN i % 5 = 3 THEN 'Morning Mini #' || i
        ELSE 'Mini Challenge ' || i
      END,
      'author', 'Test Author ' || (i % 20),
      'type', 'Mini',
      'description', 'A mini crossword puzzle for load testing'
    ),
    'solution', (SELECT jsonb_agg(
      (SELECT jsonb_agg(chr(65 + floor(random() * 26)::int)) FROM generate_series(1, 5))
    ) FROM generate_series(1, 5)),
    'circles', '[]'::jsonb,
    'shades', '[]'::jsonb
  ),
  (SELECT id FROM users ORDER BY random() LIMIT 1),
  md5('mini-' || i)
FROM generate_series(1, 200) AS i;

-- Standard puzzles (15x15) — ~250
INSERT INTO puzzles (pid, is_public, uploaded_at, content, uploaded_by, content_hash)
SELECT
  'lt-std-' || i,
  false,
  NOW() - (random() * interval '365 days'),
  jsonb_build_object(
    'grid', (SELECT jsonb_agg(
      (SELECT jsonb_agg(
        CASE WHEN random() < 0.17 THEN '.'
             ELSE chr(65 + floor(random() * 26)::int)
        END
      ) FROM generate_series(1, 15))
    ) FROM generate_series(1, 15)),
    'clues', jsonb_build_object(
      'across', (SELECT jsonb_object_agg(i2::text, 'Standard across clue ' || i2 || ' for puzzle ' || i)
        FROM generate_series(1, 40) AS i2),
      'down', (SELECT jsonb_object_agg(i2::text, 'Standard down clue ' || i2 || ' puzzle ' || i)
        FROM generate_series(1, 35) AS i2)
    ),
    'info', jsonb_build_object(
      'title', CASE
        WHEN i % 6 = 0 THEN 'NYT Crossword Puzzle #' || (10000 + i)
        WHEN i % 6 = 1 THEN 'Sunday Challenge ' || i
        WHEN i % 6 = 2 THEN 'Daily Crossword ' || i
        WHEN i % 6 = 3 THEN 'Weekend Puzzle ' || i
        WHEN i % 6 = 4 THEN 'Classic Crossword ' || i
        ELSE 'Themed Puzzle: Testing ' || i
      END,
      'author', 'Test Author ' || (i % 30),
      'type', 'Daily Puzzle',
      'description', 'A standard 15x15 crossword for load testing'
    ),
    'solution', (SELECT jsonb_agg(
      (SELECT jsonb_agg(chr(65 + floor(random() * 26)::int)) FROM generate_series(1, 15))
    ) FROM generate_series(1, 15)),
    'circles', '[]'::jsonb,
    'shades', '[]'::jsonb
  ),
  (SELECT id FROM users ORDER BY random() LIMIT 1),
  md5('std-' || i)
FROM generate_series(1, 250) AS i;

-- Large puzzles (21x21) — ~50
INSERT INTO puzzles (pid, is_public, uploaded_at, content, uploaded_by, content_hash)
SELECT
  'lt-lg-' || i,
  false,
  NOW() - (random() * interval '365 days'),
  jsonb_build_object(
    'grid', (SELECT jsonb_agg(
      (SELECT jsonb_agg(
        CASE WHEN random() < 0.17 THEN '.'
             ELSE chr(65 + floor(random() * 26)::int)
        END
      ) FROM generate_series(1, 21))
    ) FROM generate_series(1, 21)),
    'clues', jsonb_build_object(
      'across', (SELECT jsonb_object_agg(i2::text, 'Large across clue ' || i2 || ' puzzle ' || i)
        FROM generate_series(1, 70) AS i2),
      'down', (SELECT jsonb_object_agg(i2::text, 'Large down clue ' || i2 || ' puzzle ' || i)
        FROM generate_series(1, 65) AS i2)
    ),
    'info', jsonb_build_object(
      'title', 'Sunday NYT Crossword #' || (20000 + i),
      'author', 'Test Author ' || (i % 10),
      'type', 'Daily Puzzle',
      'description', 'A large 21x21 crossword for load testing'
    ),
    'solution', (SELECT jsonb_agg(
      (SELECT jsonb_agg(chr(65 + floor(random() * 26)::int)) FROM generate_series(1, 21))
    ) FROM generate_series(1, 21)),
    'circles', '[]'::jsonb,
    'shades', '[]'::jsonb
  ),
  (SELECT id FROM users ORDER BY random() LIMIT 1),
  md5('lg-' || i)
FROM generate_series(1, 50) AS i;

-- Update times_solved counters (will be filled in after puzzle_solves)
-- Done after game_events section below.

-- ============================================================
-- 3. GAMES + GAME_EVENTS (~2000 games, ~10 events each = ~20K events)
-- ============================================================

-- Advance the gid counter past our seed range
SELECT setval('gid_counter', 100002000);

-- Create initial 'create' events for each game
INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
SELECT
  'lt-game-' || i,
  NULL,
  NOW() - (random() * interval '180 days'),
  'create',
  json_build_object(
    'timestamp', extract(epoch from NOW() - (random() * interval '180 days')) * 1000,
    'type', 'create',
    'params', json_build_object(
      'pid', CASE
        WHEN i % 3 = 0 THEN 'lt-mini-' || (1 + (i % 200))
        WHEN i % 3 = 1 THEN 'lt-std-' || (1 + (i % 250))
        ELSE 'lt-lg-' || (1 + (i % 50))
      END,
      'version', 1.0
    )
  )
FROM generate_series(1, 2000) AS i;

-- Add updateCell events (~8 per game on average = ~16K events)
INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
SELECT
  'lt-game-' || game_id,
  'loadtest_user_' || (1 + (event_num % 200)),
  base_time + (event_num * interval '5 seconds'),
  'updateCell',
  json_build_object(
    'user', 'loadtest_user_' || (1 + (event_num % 200)),
    'timestamp', extract(epoch from base_time + (event_num * interval '5 seconds')) * 1000,
    'type', 'updateCell',
    'params', json_build_object(
      'cell', json_build_object('r', event_num % 15, 'c', (event_num * 3) % 15),
      'value', chr(65 + (event_num % 26)),
      'id', 'loadtest_user_' || (1 + (event_num % 200))
    )
  )
FROM generate_series(1, 2000) AS game_id,
     generate_series(1, 8) AS event_num,
     LATERAL (SELECT NOW() - (random() * interval '180 days') AS base_time) AS t
WHERE random() < 0.85;  -- ~85% fill rate for variety

-- Add check/reveal events (~2 per game = ~4K events)
INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
SELECT
  'lt-game-' || game_id,
  'loadtest_user_' || (1 + (game_id % 200)),
  NOW() - (random() * interval '180 days') + interval '1 minute',
  CASE WHEN event_num = 1 THEN 'check' ELSE 'reveal' END,
  json_build_object(
    'user', 'loadtest_user_' || (1 + (game_id % 200)),
    'timestamp', extract(epoch from NOW()) * 1000,
    'type', CASE WHEN event_num = 1 THEN 'check' ELSE 'reveal' END,
    'params', json_build_object(
      'scope', json_build_array(json_build_object('r', 0, 'c', 0)),
      'id', 'loadtest_user_' || (1 + (game_id % 200))
    )
  )
FROM generate_series(1, 2000) AS game_id,
     generate_series(1, 2) AS event_num
WHERE random() < 0.5;  -- ~50% of games have check/reveal

-- ============================================================
-- 4. PUZZLE_SOLVES (~1500 solve records)
-- ============================================================
INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
SELECT
  CASE
    WHEN i % 3 = 0 THEN 'lt-mini-' || (1 + (i % 200))
    WHEN i % 3 = 1 THEN 'lt-std-' || (1 + (i % 250))
    ELSE 'lt-lg-' || (1 + (i % 50))
  END,
  'lt-game-' || i,
  NOW() - (random() * interval '180 days'),
  -- Mini: 60-300s, Standard: 300-3600s, Large: 1800-7200s
  CASE
    WHEN i % 3 = 0 THEN 60 + floor(random() * 240)::int
    WHEN i % 3 = 1 THEN 300 + floor(random() * 3300)::int
    ELSE 1800 + floor(random() * 5400)::int
  END,
  (SELECT id FROM users WHERE email = 'loadtest_user_' || (1 + (i % 200)) || '@test.example.com'),
  1 + floor(random() * 4)::int
FROM generate_series(1, 1500) AS i;

-- Update times_solved on puzzles to match
UPDATE puzzles SET times_solved = sub.cnt
FROM (
  SELECT pid, count(*) AS cnt FROM puzzle_solves GROUP BY pid
) AS sub
WHERE puzzles.pid = sub.pid;

-- ============================================================
-- 5. GAME_SNAPSHOTS (~1000 completed games)
-- ============================================================
INSERT INTO game_snapshots (gid, pid, snapshot, replay_retained)
SELECT
  'lt-game-' || i,
  CASE
    WHEN i % 3 = 0 THEN 'lt-mini-' || (1 + (i % 200))
    WHEN i % 3 = 1 THEN 'lt-std-' || (1 + (i % 250))
    ELSE 'lt-lg-' || (1 + (i % 50))
  END,
  jsonb_build_object(
    'grid', (SELECT jsonb_agg(
      (SELECT jsonb_agg(chr(65 + floor(random() * 26)::int)) FROM generate_series(1, 5))
    ) FROM generate_series(1, 5)),
    'users', jsonb_build_object(
      'loadtest_user_' || (1 + (i % 200)), jsonb_build_object('displayName', 'Test User', 'color', 'blue')
    ),
    'clock', jsonb_build_object('totalTime', 300 + floor(random() * 3000)::int, 'paused', false),
    'solved', true
  ),
  i % 5 = 0  -- 20% retain replay
FROM generate_series(1, 1000) AS i;

-- ============================================================
-- 6. ANALYZE tables so the query planner has good stats
-- ============================================================
ANALYZE users;
ANALYZE puzzles;
ANALYZE game_events;
ANALYZE puzzle_solves;
ANALYZE game_snapshots;

COMMIT;

-- Summary
SELECT 'Seed complete' AS status,
  (SELECT count(*) FROM users) AS users,
  (SELECT count(*) FROM puzzles) AS puzzles,
  (SELECT count(*) FROM game_events) AS game_events,
  (SELECT count(*) FROM puzzle_solves) AS puzzle_solves,
  (SELECT count(*) FROM game_snapshots) AS game_snapshots;
