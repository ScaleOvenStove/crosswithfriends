CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  auth_provider TEXT NOT NULL,
  oauth_id TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_provider_id_idx
  ON users (auth_provider, oauth_id)
  WHERE oauth_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_email_idx
  ON users (email)
  WHERE email IS NOT NULL;
