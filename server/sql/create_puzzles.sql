-- psql < create_puzzles.sql

-- extension needed for trigram index support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE
IF NOT EXISTS puzzles
(
  uid text,

  -- properties managed by dfac
  pid text PRIMARY KEY,
  pid_numeric numeric, -- the pid as a number, if exists. NULL otherwise
  is_public boolean,
  uploaded_at timestamp without time zone,
  times_solved numeric DEFAULT 0 CHECK (times_solved >= 0),

  -- static properties of the puzzle
  content jsonb,

  -- who uploaded this puzzle (NULL for puzzles uploaded before auth)
  uploaded_by UUID REFERENCES users(id),

  -- SHA-256 hash for duplicate detection
  content_hash text,

  -- denormalized solve-time stats, maintained transactionally in recordSolve.
  -- median_solve_ms is NULL until solve_sample_count reaches the min-samples
  -- threshold (see PUZZLE_STATS_MIN_SAMPLES in model/puzzle.ts).
  median_solve_ms integer,
  solve_sample_count integer NOT NULL DEFAULT 0 CHECK (solve_sample_count >= 0),

  -- denormalized rating stats, maintained transactionally in upsert/deleteRating.
  -- rating_weighted is the Bayesian-shrunk score used for rating_desc sort.
  rating_avg double precision,
  rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  rating_weighted double precision
);

ALTER TABLE public.puzzles
    OWNER to dfacadmin;

-- GRANT ALL ON TABLE public.puzzles TO dfac_staging;
GRANT ALL ON TABLE public.puzzles TO dfacadmin;

-- trigram index for ILIKE %foo% searches https://about.gitlab.com/blog/2016/03/18/fast-search-using-postgresql-trigram-indexes/
CREATE INDEX puzzle_name_and_title_trigrams
    ON public.puzzles USING GIST ( ((content -> 'info' ->> 'title') || ' ' || (content->'info'->>'author')) gist_trgm_ops);

CREATE INDEX puzzle_pid_numeric_desc
    ON public.puzzles USING btree
    (pid_numeric DESC NULLS LAST)
    TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS puzzles_content_hash_public
    ON puzzles (content_hash) WHERE is_public = true AND content_hash IS NOT NULL;
