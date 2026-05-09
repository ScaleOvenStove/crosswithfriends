-- psql < create_puzzle_ratings.sql

CREATE TABLE
    IF NOT EXISTS puzzle_ratings
(
    pid text NOT NULL REFERENCES puzzles ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT, -- reserved for future use; not exposed in current UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (pid, user_id)
);

-- Aggregate lookups for puzzle list (avg/count by pid)
CREATE INDEX IF NOT EXISTS puzzle_ratings_pid_idx
  ON puzzle_ratings (pid);

ALTER TABLE public.puzzle_ratings
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.puzzle_ratings TO dfacadmin;
