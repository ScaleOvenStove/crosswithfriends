-- Migration: 002_create_puzzles.sql
-- Creates the puzzles table and related indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS puzzles (
    uid text,
    -- properties managed by dfac
    pid text PRIMARY KEY,
    pid_numeric numeric,
    -- the pid as a number, if exists. NULL otherwise
    is_public boolean,
    uploaded_at timestamp without time zone,
    times_solved numeric DEFAULT 0 CHECK (times_solved >= 0),
    -- static properties of the puzzle
    content jsonb
);
ALTER TABLE public.puzzles OWNER to CURRENT_USER;
GRANT ALL ON TABLE public.puzzles TO CURRENT_USER;
-- trigram index for ILIKE %foo% searches https://about.gitlab.com/blog/2016/03/18/fast-search-using-postgresql-trigram-indexes/
CREATE INDEX IF NOT EXISTS puzzle_name_and_title_trigrams ON public.puzzles USING GIST (
    (
        (content->'info'->>'title') || ' ' || (content->'info'->>'author')
    ) gist_trgm_ops
);
CREATE INDEX IF NOT EXISTS puzzle_pid_numeric_desc ON public.puzzles USING btree (pid_numeric DESC NULLS LAST) TABLESPACE pg_default;