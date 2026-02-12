-- psql < create_puzzle_solves.sql

CREATE TABLE
    IF NOT EXISTS puzzle_solves
(
    -- only allow a puzzle solve to be recorded if the puzzle exists, and when a puzzle is deleted, also delete the solves
    pid text NOT NULL REFERENCES puzzles ON DELETE CASCADE,
    gid text NOT NULL,
    solved_time timestamp without time zone, -- the time the solve was recorded
    time_taken_to_solve integer CHECK (time_taken_to_solve > 0), -- the duration (seconds) of how long it took to solve
    user_id UUID REFERENCES users(id), -- authenticated user who solved (NULL for anonymous)
    player_count integer DEFAULT 1 -- number of players in the game at solve time
);

-- One record per authenticated user per game
CREATE UNIQUE INDEX IF NOT EXISTS puzzle_solves_user_game_idx
  ON puzzle_solves (pid, gid, user_id) WHERE user_id IS NOT NULL;

-- Keep one anonymous record per game
CREATE UNIQUE INDEX IF NOT EXISTS puzzle_solves_anon_game_idx
  ON puzzle_solves (pid, gid) WHERE user_id IS NULL;

-- Fast lookups by user for profile/stats queries
CREATE INDEX IF NOT EXISTS puzzle_solves_user_id_idx
  ON puzzle_solves (user_id) WHERE user_id IS NOT NULL;

-- GRANT ALL ON TABLE public.puzzle_solves TO dfac_staging;
-- GRANT ALL ON TABLE public.puzzle_solves TO dfac_production;
ALTER TABLE public.puzzle_solves
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.puzzle_solves TO dfacadmin;