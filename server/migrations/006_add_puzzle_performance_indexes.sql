-- Migration: 006_add_puzzle_performance_indexes.sql
-- Performance optimization indexes for puzzle list queries
-- Run this migration to improve puzzle list loading performance

-- 1. Partial index on is_public = true (most queries filter by this)
-- This significantly speeds up queries that filter by is_public
CREATE INDEX IF NOT EXISTS puzzles_is_public_pid_numeric_idx
    ON public.puzzles (pid_numeric DESC NULLS LAST)
    WHERE is_public = true;

-- 2. Trigram index for new ipuz format (content->>'title' and content->>'author')
-- This complements the existing index for old format
CREATE INDEX IF NOT EXISTS puzzle_ipuz_title_author_trigrams
    ON public.puzzles USING GIST (
        ((COALESCE(content ->> 'title', '') || ' ' || COALESCE(content ->> 'author', ''))) gist_trgm_ops
    )
    WHERE is_public = true;

-- 3. Combined trigram index that covers both old and new formats
-- This helps when searching across both formats
CREATE INDEX IF NOT EXISTS puzzle_combined_title_author_trigrams
    ON public.puzzles USING GIST (
        ((COALESCE(content ->> 'title', content -> 'info' ->> 'title', '') || ' ' ||
          COALESCE(content ->> 'author', content -> 'info' ->> 'author', ''))) gist_trgm_ops
    )
    WHERE is_public = true;

-- 4. Index for size filtering (solution array length)
-- This helps when filtering by puzzle size (Mini vs Standard)
CREATE INDEX IF NOT EXISTS puzzles_solution_length_idx
    ON public.puzzles (
        CASE
            WHEN content->'info'->>'type' IS NOT NULL THEN
                (content->'info'->>'type')
            WHEN jsonb_array_length(content->'solution') <= 10 THEN 'Mini Puzzle'
            ELSE 'Daily Puzzle'
        END
    )
    WHERE is_public = true;

-- Note: The existing indexes are kept for backward compatibility
-- You may want to drop the old puzzle_name_and_title_trigrams index after verifying
-- the new indexes work correctly, but keeping it is safe and doesn't hurt performance

