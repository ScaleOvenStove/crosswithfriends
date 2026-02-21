-- psql < create_game_snapshots.sql
--
-- Stores the final game state at solve time so solved puzzles can be viewed
-- without replaying thousands of individual game_events.

CREATE TABLE IF NOT EXISTS game_snapshots
(
    gid text PRIMARY KEY,
    pid text NOT NULL,
    snapshot jsonb NOT NULL,                          -- final grid + users + chat + clock state
    replay_retained boolean NOT NULL DEFAULT false,   -- user opted to keep replay event data
    created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_snapshots_pid_idx
    ON game_snapshots (pid);

ALTER TABLE public.game_snapshots
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.game_snapshots TO dfacadmin;
