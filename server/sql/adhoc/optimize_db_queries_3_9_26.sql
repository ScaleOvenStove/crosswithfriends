-- Optimization indexes added 2026-03-09
-- These address missing index coverage identified during DB performance investigation.

-- 1. game_events: event_type is frequently filtered (e.g. WHERE event_type = 'create',
--    WHERE event_type IN ('check', 'reveal')). Composite with gid for common access pattern.
CREATE INDEX CONCURRENTLY IF NOT EXISTS game_events_gid_event_type_idx
  ON game_events (gid, event_type);

-- 2. email_verification_tokens: user_id lookups for token cleanup/invalidation
CREATE INDEX CONCURRENTLY IF NOT EXISTS email_verification_tokens_user_id_idx
  ON email_verification_tokens (user_id) WHERE used_at IS NULL;

-- 3. password_reset_tokens: same pattern as email verification
CREATE INDEX CONCURRENTLY IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id) WHERE used_at IS NULL;
