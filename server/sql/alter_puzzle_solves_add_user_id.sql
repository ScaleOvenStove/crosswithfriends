-- Migration: Add user_id and player_count to puzzle_solves for user profiles & multiplayer tracking
-- Run this on existing databases before deploying Phase 3.

-- Add new columns
ALTER TABLE puzzle_solves ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE puzzle_solves ADD COLUMN IF NOT EXISTS player_count INTEGER DEFAULT 1;

-- Drop old constraint that only allows one row per (pid, gid)
-- We now need multiple rows per game — one per authenticated participant
ALTER TABLE puzzle_solves DROP CONSTRAINT IF EXISTS only_one_solve_per_puzzle_and_game;

-- One record per authenticated user per game
CREATE UNIQUE INDEX IF NOT EXISTS puzzle_solves_user_game_idx
  ON puzzle_solves (pid, gid, user_id) WHERE user_id IS NOT NULL;

-- Keep one anonymous record per game (backwards compat)
CREATE UNIQUE INDEX IF NOT EXISTS puzzle_solves_anon_game_idx
  ON puzzle_solves (pid, gid) WHERE user_id IS NULL;

-- Fast lookups by user for profile/stats queries
CREATE INDEX IF NOT EXISTS puzzle_solves_user_id_idx
  ON puzzle_solves (user_id) WHERE user_id IS NOT NULL;
