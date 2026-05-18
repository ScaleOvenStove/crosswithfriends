-- psql < create_game_restrictions.sql
--
-- Owner-toggleable per-action restrictions. Presence of a row for
-- (gid, action) = that action is restricted to the owner; absence =
-- everyone in the room can do it. Toggling is INSERT / DELETE; no
-- boolean column to mutate. Same shape as game_locks but keyed on
-- (gid, action) so the three actions toggle independently.

CREATE TABLE IF NOT EXISTS game_restrictions (
  gid text NOT NULL,
  action text NOT NULL CHECK (action IN ('check', 'reveal', 'reset')),
  restricted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  restricted_by_dfac_id text,
  restricted_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (gid, action)
);

-- Both "is this action restricted for this gid?" and "list restrictions
-- for this gid" are covered by the PK index on (gid, action) — Postgres
-- uses the leading column for gid-only filters. No standalone gid index
-- needed.

ALTER TABLE public.game_restrictions OWNER to dfacadmin;
GRANT ALL ON TABLE public.game_restrictions TO dfacadmin;
