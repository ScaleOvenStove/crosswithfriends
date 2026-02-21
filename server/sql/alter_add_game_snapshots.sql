-- Migration: Add game_snapshots table for storing final game state at solve time.
-- Run this on existing databases before deploying the reduce-game-events changes.
--
-- Usage:  psql -U dfacadmin -d <dbname> -f server/sql/alter_add_game_snapshots.sql

CREATE TABLE IF NOT EXISTS game_snapshots
(
    gid text PRIMARY KEY,
    pid text NOT NULL,
    snapshot jsonb NOT NULL,
    replay_retained boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_snapshots_pid_idx
    ON game_snapshots (pid);

ALTER TABLE public.game_snapshots
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.game_snapshots TO dfacadmin;
