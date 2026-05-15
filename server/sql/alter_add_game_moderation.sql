-- Add game moderation tables. Run on existing databases before deploying
-- the code. Additive only; old code ignores the new tables.

\ir create_game_bans.sql
\ir create_game_locks.sql
