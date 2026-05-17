-- psql < create_game_bans.sql
--
-- Per-game bans applied by the game owner. A "ban" is keyed on
-- (gid, identity, identity_type) — identity is either a user UUID or a
-- guest dfac_id; the type discriminates so a user_id ban and a dfac_id
-- ban with the same string can't collide. Both row types can coexist
-- for the same person (e.g. owner bans the dfac_id while the user is a
-- guest, then the user later signs in — the dfac_id ban still applies
-- because it's keyed on the dfac_id, not the user_id).

CREATE TABLE IF NOT EXISTS game_bans (
  gid text NOT NULL,
  identity text NOT NULL,
  identity_type text NOT NULL CHECK (identity_type IN ('user', 'dfac')),
  banned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  banned_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (gid, identity, identity_type)
);

-- Both "is this identity banned for this gid?" and "list bans for this
-- gid" are covered by the PK index on (gid, identity, identity_type) —
-- Postgres uses the leading column for gid-only filters. No standalone
-- gid index needed.

ALTER TABLE public.game_bans OWNER to dfacadmin;
GRANT ALL ON TABLE public.game_bans TO dfacadmin;
