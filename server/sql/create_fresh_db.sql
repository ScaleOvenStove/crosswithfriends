-- create_fresh_db.sql
-- Sets up a fresh database with all tables, indexes, and sequences.
-- Run as a superuser (e.g. postgres) or a user with CREATE privileges.
--
-- Usage:  psql -U postgres -d <dbname> -f server/sql/create_fresh_db.sql

-- ============================================================
-- 0. Prerequisites: role & extensions
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dfacadmin') THEN
    CREATE ROLE dfacadmin WITH LOGIN;
  END IF;
END
$$;

GRANT ALL ON SCHEMA public TO dfacadmin;

-- Extension needed for trigram index on puzzles
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pg_stat_statements is enabled on production (Render manages this at the
-- cluster level). Local installs don't need it; it requires superuser and
-- shared_preload_libraries='pg_stat_statements', so we skip it here.

-- ============================================================
-- 1. users (no dependencies)
-- ============================================================
\ir create_users.sql

-- ============================================================
-- 2. puzzles (depends on users)
-- ============================================================
\ir create_puzzles.sql

-- ============================================================
-- 3. game_events (no dependencies)
-- ============================================================
\ir create_game_events.sql

-- ============================================================
-- 4. room_events (no dependencies)
-- ============================================================
\ir create_room_events.sql

-- ============================================================
-- 5. id_counters / sequences (no dependencies)
-- ============================================================
\ir create_id_counters.sql

-- ============================================================
-- 6. email_auth_tables (depends on users)
-- ============================================================
\ir create_email_auth_tables.sql

-- ============================================================
-- 7. refresh_tokens (depends on users)
-- ============================================================
\ir create_refresh_tokens.sql

-- ============================================================
-- 8. puzzle_solves (depends on puzzles + users)
-- ============================================================
\ir create_puzzle_solves.sql

-- ============================================================
-- 9. user_identity_map (depends on users)
-- ============================================================
\ir create_user_identity_map.sql

-- ============================================================
-- 10. game_snapshots (no dependencies)
-- ============================================================
\ir create_game_snapshots.sql

-- ============================================================
-- 11. game_dismissals (depends on users)
-- ============================================================
\ir create_game_dismissals.sql

-- ============================================================
-- 12. firebase_history (no dependencies)
-- ============================================================
\ir create_firebase_history.sql

-- ============================================================
-- 13. puzzle_ratings (depends on puzzles + users)
-- ============================================================
\ir create_puzzle_ratings.sql

-- ============================================================
-- 14. game_bans (depends on users)
-- ============================================================
\ir create_game_bans.sql

-- ============================================================
-- 15. game_locks (depends on users)
-- ============================================================
\ir create_game_locks.sql

-- ============================================================
-- 16. game_restrictions (depends on users)
-- ============================================================
\ir create_game_restrictions.sql

-- ============================================================
-- 17. denormalized puzzle rating/solve-time stats (depends on puzzles,
--     puzzle_solves, puzzle_ratings)
-- ============================================================
\ir alter_puzzles_add_denorm_stats.sql

-- ============================================================
-- 18. refresh_tokens.rotated flag (depends on refresh_tokens)
-- ============================================================
\ir alter_refresh_tokens_add_rotated.sql
