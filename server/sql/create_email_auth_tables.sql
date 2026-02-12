-- Email verification & password reset tables + users.email_verified_at column
-- Run after create_users.sql

-- Add email_verified_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITHOUT TIME ZONE;
-- Auto-verify existing Google users (they verified ownership via Google OAuth)
UPDATE users SET email_verified_at = created_at WHERE auth_provider = 'google' AND email_verified_at IS NULL;

-- Tokens for email verification (signup + email change)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  new_email TEXT,  -- NULL = signup verification; SET = email change verification
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITHOUT TIME ZONE
);

-- Tokens for password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITHOUT TIME ZONE
);
