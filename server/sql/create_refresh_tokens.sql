CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITHOUT TIME ZONE,
  -- True when this token was revoked specifically by rotation (vs. logout or a
  -- security flow). Only rotation-revoked tokens drive reuse detection.
  rotated BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id);
