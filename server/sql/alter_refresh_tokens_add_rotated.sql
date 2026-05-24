-- alter_refresh_tokens_add_rotated.sql
-- Adds a flag marking tokens revoked specifically by rotation, so reuse
-- detection only fires for rotation-revoked tokens and never for tokens
-- revoked by logout / security flows.
--
-- Usage:  psql -U dfacadmin -d <dbname> -f server/sql/alter_refresh_tokens_add_rotated.sql

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS rotated BOOLEAN NOT NULL DEFAULT false;
