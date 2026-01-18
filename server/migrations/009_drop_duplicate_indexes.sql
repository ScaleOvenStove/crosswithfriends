-- Migration: 009_drop_duplicate_indexes.sql
-- Drops duplicate indexes covered by existing composite indexes.

DROP INDEX IF EXISTS public.game_events_gid_ts_idx_new;
DROP INDEX IF EXISTS public.idx_puzzle_clues_pid;
