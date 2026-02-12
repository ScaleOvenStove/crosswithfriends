CREATE TABLE IF NOT EXISTS user_identity_map (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dfac_id TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, dfac_id)
);

CREATE INDEX IF NOT EXISTS user_identity_map_dfac_id_idx
  ON user_identity_map (dfac_id);
