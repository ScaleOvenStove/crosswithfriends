-- alter_add_perf_indexes.sql
-- Adds missing indexes on hot read paths. Safe and additive.
--
-- Usage:  psql -U dfacadmin -d <dbname> -f server/sql/alter_add_perf_indexes.sql
--
-- Run with CONCURRENTLY so these don't take a heavy lock on large/live tables.
-- CONCURRENTLY cannot run inside a transaction block; psql runs each statement
-- in its own autocommit transaction by default, so do NOT wrap this in BEGIN.

-- firebase_history is keyed by (dfac_id, gid). Several hot queries join/filter
-- on gid ALONE (LEFT JOIN ... ON fh.gid = ug.gid, and NOT EXISTS subqueries),
-- which can't use the (dfac_id, gid) PK and fall back to a sequential scan of
-- this large legacy table.
-- Benefits: getInProgressGames, getUserGamesForPuzzle, puzzle-status queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_firebase_history_gid
  ON firebase_history (gid);

-- game_dismissals is keyed by (user_id, gid). The correlated NOT EXISTS
-- subqueries match on gid (and user_id), so a (gid, user_id) index supports
-- the gid-leading correlated form the PK can't.
-- Benefits: getAuthenticatedPuzzleStatuses, getInProgressGames, getUserGamesForPuzzle.
CREATE INDEX CONCURRENTLY IF NOT EXISTS game_dismissals_gid_user_idx
  ON game_dismissals (gid, user_id);

-- wasParticipantOfGame() probes game_events for a gid filtered by the
-- server-stamped verifiedUserId. gid is covered by game_events_gid_ts_idx, but
-- without an index on the verifiedUserId expression every event row for that
-- gid is scanned and filtered in memory. Partial (verifiedUserId IS NOT NULL)
-- keeps the index small: only authenticated events carry the field.
-- Benefits: wasParticipantOfGame (lock-bypass on reconnect, keep-replay and
--           record_solve participation checks).
CREATE INDEX CONCURRENTLY IF NOT EXISTS game_events_gid_verified_user_idx
  ON game_events (gid, ((event_payload->>'verifiedUserId')))
  WHERE (event_payload->>'verifiedUserId') IS NOT NULL;
