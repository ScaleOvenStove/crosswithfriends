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

-- Aggregate lookups by pid (avg/count for puzzle list, eligibility checks)
-- are served by the (pid, user_id) PRIMARY KEY's B-tree index, since pid is
-- the leading column. No separate index on (pid) is needed.

ALTER TABLE public.puzzle_ratings
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.puzzle_ratings TO dfacadmin;
