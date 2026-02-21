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
