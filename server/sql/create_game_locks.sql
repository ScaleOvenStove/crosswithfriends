-- psql < create_game_locks.sql
--
-- Owner-toggleable lock that blocks all new joins to a game. Presence of
-- a row = locked; absence = unlocked. Toggling is INSERT / DELETE; no
-- boolean column to mutate.

CREATE TABLE IF NOT EXISTS game_locks (
  gid text PRIMARY KEY,
  locked_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  locked_by_dfac_id text,
  locked_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.game_locks OWNER to dfacadmin;
GRANT ALL ON TABLE public.game_locks TO dfacadmin;
