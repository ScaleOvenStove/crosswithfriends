CREATE TABLE IF NOT EXISTS game_dismissals (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gid TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, gid)
);

-- Supports the gid-leading correlated NOT EXISTS subqueries the (user_id, gid)
-- PK can't serve.
CREATE INDEX IF NOT EXISTS game_dismissals_gid_user_idx ON game_dismissals (gid, user_id);
