-- Migration: 009_rollback_normalized_schema.sql
-- Rollback migration for 008_normalize_puzzle_schema.sql
-- 
-- This migration reverses the schema normalization changes and restores
-- the original schema structure.
--
-- WARNING: Only run this if you need to rollback to the previous schema.
-- This will:
-- 1. Rename puzzle_data back to content
-- 2. Drop the puzzle_clues table and its data
-- 3. Drop normalized columns (title, author, etc.)
-- 4. Drop new indexes
-- 5. Drop the sync_puzzle_clues trigger and function

-- ============================================================================
-- PHASE 1: Drop the trigger
-- ============================================================================

DROP TRIGGER IF EXISTS sync_clues_trigger ON puzzles;

-- ============================================================================
-- PHASE 2: Rename puzzle_data back to content
-- ============================================================================

-- Check if column exists before renaming
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'puzzles' AND column_name = 'puzzle_data'
    ) THEN
        ALTER TABLE public.puzzles RENAME COLUMN puzzle_data TO content;
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: Drop new indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_puzzles_title_author_trgm;
DROP INDEX IF EXISTS idx_puzzles_type;
DROP INDEX IF EXISTS idx_puzzles_list_filter;
DROP INDEX IF EXISTS idx_puzzles_public_uploaded;

-- ============================================================================
-- PHASE 4: Drop CHECK constraints
-- ============================================================================

ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_width_positive;
ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_height_positive;

-- ============================================================================
-- PHASE 5: Drop puzzle_clues table and its indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_puzzle_clues_pid;
DROP INDEX IF EXISTS idx_puzzle_clues_text_search;
DROP TABLE IF EXISTS puzzle_clues;

-- ============================================================================
-- PHASE 6: Drop normalized columns
-- ============================================================================

-- Note: Generated columns must be dropped before their dependencies
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS puzzle_type;

ALTER TABLE public.puzzles DROP COLUMN IF EXISTS title;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS author;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS copyright;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS notes;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS version;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS kind;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS width;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS height;
ALTER TABLE public.puzzles DROP COLUMN IF EXISTS updated_at;

-- ============================================================================
-- PHASE 7: Drop the sync function
-- ============================================================================

DROP FUNCTION IF EXISTS sync_puzzle_clues();

-- ============================================================================
-- Summary of rollback:
-- ============================================================================
--
-- This rollback:
-- 1. Renamed puzzle_data -> content (original column name)
-- 2. Dropped puzzle_clues table
-- 3. Dropped normalized columns (title, author, copyright, notes, version, kind, width, height, puzzle_type, updated_at)
-- 4. Dropped new indexes (idx_puzzles_title_author_trgm, idx_puzzles_type, idx_puzzles_list_filter, idx_puzzles_public_uploaded)
-- 5. Dropped sync_puzzle_clues trigger and function
--
-- The original indexes from migrations 002 and 006 are preserved:
-- - puzzle_name_and_title_trigrams
-- - puzzle_pid_numeric_desc
-- - puzzles_is_public_pid_numeric_idx
-- - puzzle_ipuz_title_author_trigrams
-- - puzzle_combined_title_author_trigrams
-- - puzzles_solution_length_idx
--
-- After running this rollback, the code must also be reverted to use the old
-- query patterns that read from the 'content' JSONB column.




