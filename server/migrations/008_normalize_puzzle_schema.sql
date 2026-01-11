-- Migration: 008_normalize_puzzle_schema.sql
-- Normalizes puzzle schema by extracting frequently queried metadata into dedicated columns
-- This improves query performance for listing, searching, and filtering puzzles
-- 
-- Changes:
-- 1. Add normalized metadata columns (title, author, copyright, notes, version, kind)
-- 2. Add dimension columns (width, height)
-- 3. Add generated puzzle_type column
-- 4. Create puzzle_clues table for advanced clue search
-- 5. Add performance indexes on normalized columns
-- 6. Create trigger to sync clues table
-- 7. Rename content to puzzle_data

-- ============================================================================
-- PHASE 1: Add new columns (nullable initially for safe migration)
-- ============================================================================

-- Step 1.1: Add metadata columns
ALTER TABLE public.puzzles
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS author TEXT,
ADD COLUMN IF NOT EXISTS copyright TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'http://ipuz.org/v1',
ADD COLUMN IF NOT EXISTS kind TEXT[] DEFAULT ARRAY['http://ipuz.org/crossword#1'];

-- Step 1.2: Add dimension columns
ALTER TABLE public.puzzles
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER;

-- Step 1.3: Add updated_at timestamp column
ALTER TABLE public.puzzles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- ============================================================================
-- PHASE 2: Create puzzle_clues table
-- ============================================================================

CREATE TABLE IF NOT EXISTS puzzle_clues (
    id BIGSERIAL PRIMARY KEY,
    pid TEXT NOT NULL REFERENCES puzzles(pid) ON DELETE CASCADE,
    clue_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('Across', 'Down')),
    clue_text TEXT NOT NULL,
    -- Store cell positions for advanced features (optional)
    cell_positions INTEGER[][],
    UNIQUE(pid, clue_number, direction)
);

-- Set ownership
ALTER TABLE public.puzzle_clues OWNER to CURRENT_USER;
GRANT ALL ON TABLE public.puzzle_clues TO CURRENT_USER;

-- Index on pid for fast lookup
CREATE INDEX IF NOT EXISTS idx_puzzle_clues_pid ON puzzle_clues (pid);

-- Full-text search index on clue text
CREATE INDEX IF NOT EXISTS idx_puzzle_clues_text_search ON puzzle_clues
    USING GIN (to_tsvector('english', clue_text));

-- ============================================================================
-- PHASE 3: Backfill data from content JSONB
-- ============================================================================

-- Step 3.1: Backfill title (handles both old format and ipuz format)
UPDATE public.puzzles
SET title = COALESCE(
    content->>'title',           -- ipuz format
    content->'info'->>'title',   -- old format
    'Untitled'                   -- fallback
)
WHERE title IS NULL;

-- Step 3.2: Backfill author (handles both old format and ipuz format)
UPDATE public.puzzles
SET author = COALESCE(
    content->>'author',          -- ipuz format
    content->'info'->>'author',  -- old format
    'Unknown'                    -- fallback
)
WHERE author IS NULL;

-- Step 3.3: Backfill copyright
UPDATE public.puzzles
SET copyright = COALESCE(
    content->>'copyright',
    content->'info'->>'copyright',
    ''
)
WHERE copyright IS NULL;

-- Step 3.4: Backfill notes
UPDATE public.puzzles
SET notes = COALESCE(
    content->>'notes',
    content->'info'->>'notes',
    content->'info'->>'description',
    ''
)
WHERE notes IS NULL;

-- Step 3.5: Backfill version
UPDATE public.puzzles
SET version = COALESCE(
    content->>'version',
    'http://ipuz.org/v1'
)
WHERE version IS NULL OR version = 'http://ipuz.org/v1';

-- Step 3.6: Backfill kind array
UPDATE public.puzzles
SET kind = COALESCE(
    (SELECT array_agg(elem::text) FROM jsonb_array_elements_text(content->'kind') AS elem),
    ARRAY['http://ipuz.org/crossword#1']
)
WHERE kind IS NULL OR kind = ARRAY['http://ipuz.org/crossword#1'];

-- Step 3.7: Backfill width
-- Try dimensions.width first, then calculate from solution array
UPDATE public.puzzles
SET width = COALESCE(
    (content->'dimensions'->>'width')::INTEGER,
    -- Calculate from first row of solution array
    (SELECT jsonb_array_length(content->'solution'->0))::INTEGER,
    -- Calculate from puzzle array if solution doesn't exist
    (SELECT jsonb_array_length(content->'puzzle'->0))::INTEGER,
    0
)
WHERE width IS NULL;

-- Step 3.8: Backfill height
-- Try dimensions.height first, then calculate from solution array
UPDATE public.puzzles
SET height = COALESCE(
    (content->'dimensions'->>'height')::INTEGER,
    -- Calculate from solution array length (number of rows)
    (SELECT jsonb_array_length(content->'solution'))::INTEGER,
    -- Calculate from puzzle array if solution doesn't exist
    (SELECT jsonb_array_length(content->'puzzle'))::INTEGER,
    0
)
WHERE height IS NULL;

-- Step 3.9: Set updated_at to uploaded_at for existing records
UPDATE public.puzzles
SET updated_at = COALESCE(uploaded_at, NOW())
WHERE updated_at IS NULL;

-- ============================================================================
-- PHASE 4: Add generated column for puzzle_type
-- ============================================================================

-- Note: Generated columns require PostgreSQL 12+
-- The puzzle_type is computed based on height: Mini if <= 10, Daily otherwise
ALTER TABLE public.puzzles
ADD COLUMN IF NOT EXISTS puzzle_type TEXT GENERATED ALWAYS AS (
    CASE WHEN height <= 10 THEN 'Mini Puzzle' ELSE 'Daily Puzzle' END
) STORED;

-- ============================================================================
-- PHASE 5: Create function and trigger to sync puzzle_clues table
-- ============================================================================

-- Function to extract and store clues from puzzle_data
CREATE OR REPLACE FUNCTION sync_puzzle_clues()
RETURNS TRIGGER AS $$
DECLARE
    clue_item JSONB;
    clue_num TEXT;
    clue_txt TEXT;
    puzzle_content JSONB;
BEGIN
    -- Use the appropriate column name (content or puzzle_data)
    puzzle_content := COALESCE(NEW.content, NEW.puzzle_data);
    
    IF puzzle_content IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Delete existing clues for this puzzle
    DELETE FROM puzzle_clues WHERE pid = NEW.pid;

    -- Insert Across clues
    -- Handle both ipuz format (clues.Across) and old format variations
    IF puzzle_content->'clues'->'Across' IS NOT NULL THEN
        FOR clue_item IN SELECT * FROM jsonb_array_elements(puzzle_content->'clues'->'Across')
        LOOP
            -- Handle both object format {number, clue} and array format [number, clue]
            IF jsonb_typeof(clue_item) = 'object' THEN
                clue_num := COALESCE(clue_item->>'number', clue_item->>'num', '0');
                clue_txt := COALESCE(clue_item->>'clue', clue_item->>'text', '');
            ELSIF jsonb_typeof(clue_item) = 'array' THEN
                clue_num := COALESCE(clue_item->>0, '0');
                clue_txt := COALESCE(clue_item->>1, '');
            ELSE
                CONTINUE;
            END IF;
            
            IF clue_txt != '' THEN
                INSERT INTO puzzle_clues (pid, clue_number, direction, clue_text)
                VALUES (NEW.pid, clue_num, 'Across', clue_txt)
                ON CONFLICT (pid, clue_number, direction) DO UPDATE
                SET clue_text = EXCLUDED.clue_text;
            END IF;
        END LOOP;
    END IF;

    -- Insert Down clues
    IF puzzle_content->'clues'->'Down' IS NOT NULL THEN
        FOR clue_item IN SELECT * FROM jsonb_array_elements(puzzle_content->'clues'->'Down')
        LOOP
            -- Handle both object format {number, clue} and array format [number, clue]
            IF jsonb_typeof(clue_item) = 'object' THEN
                clue_num := COALESCE(clue_item->>'number', clue_item->>'num', '0');
                clue_txt := COALESCE(clue_item->>'clue', clue_item->>'text', '');
            ELSIF jsonb_typeof(clue_item) = 'array' THEN
                clue_num := COALESCE(clue_item->>0, '0');
                clue_txt := COALESCE(clue_item->>1, '');
            ELSE
                CONTINUE;
            END IF;
            
            IF clue_txt != '' THEN
                INSERT INTO puzzle_clues (pid, clue_number, direction, clue_text)
                VALUES (NEW.pid, clue_num, 'Down', clue_txt)
                ON CONFLICT (pid, clue_number, direction) DO UPDATE
                SET clue_text = EXCLUDED.clue_text;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync clues on insert/update
-- Note: Trigger name uses content column; will work with puzzle_data after rename
DROP TRIGGER IF EXISTS sync_clues_trigger ON puzzles;
CREATE TRIGGER sync_clues_trigger
    AFTER INSERT OR UPDATE OF content ON puzzles
    FOR EACH ROW
    EXECUTE FUNCTION sync_puzzle_clues();

-- ============================================================================
-- PHASE 6: Populate puzzle_clues for existing puzzles
-- ============================================================================

-- Run the sync function for all existing puzzles
-- This is done by triggering an UPDATE that doesn't change the content
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT pid FROM puzzles
    LOOP
        BEGIN
            -- Trigger the sync by updating a non-content field
            -- The trigger will extract clues from content
            PERFORM sync_puzzle_clues() FROM puzzles WHERE pid = r.pid;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other puzzles
            RAISE NOTICE 'Failed to sync clues for puzzle %: %', r.pid, SQLERRM;
        END;
    END LOOP;
END $$;

-- Alternative: Direct insert for all puzzles (more efficient for large datasets)
INSERT INTO puzzle_clues (pid, clue_number, direction, clue_text)
SELECT 
    p.pid,
    COALESCE(clue->>'number', clue->>'num', clue->>0, '0') as clue_number,
    'Across' as direction,
    COALESCE(clue->>'clue', clue->>'text', clue->>1, '') as clue_text
FROM puzzles p,
     jsonb_array_elements(p.content->'clues'->'Across') as clue
WHERE p.content->'clues'->'Across' IS NOT NULL
  AND COALESCE(clue->>'clue', clue->>'text', clue->>1, '') != ''
ON CONFLICT (pid, clue_number, direction) DO NOTHING;

INSERT INTO puzzle_clues (pid, clue_number, direction, clue_text)
SELECT 
    p.pid,
    COALESCE(clue->>'number', clue->>'num', clue->>0, '0') as clue_number,
    'Down' as direction,
    COALESCE(clue->>'clue', clue->>'text', clue->>1, '') as clue_text
FROM puzzles p,
     jsonb_array_elements(p.content->'clues'->'Down') as clue
WHERE p.content->'clues'->'Down' IS NOT NULL
  AND COALESCE(clue->>'clue', clue->>'text', clue->>1, '') != ''
ON CONFLICT (pid, clue_number, direction) DO NOTHING;

-- ============================================================================
-- PHASE 7: Add performance indexes on normalized columns
-- ============================================================================

-- Trigram index for fuzzy title/author search (on normalized columns)
CREATE INDEX IF NOT EXISTS idx_puzzles_title_author_trgm ON puzzles
    USING GIST ((title || ' ' || author) gist_trgm_ops)
    WHERE is_public = true;

-- Index on puzzle_type for size filtering
CREATE INDEX IF NOT EXISTS idx_puzzles_type ON puzzles (puzzle_type)
    WHERE is_public = true;

-- Composite index for filtered list queries
CREATE INDEX IF NOT EXISTS idx_puzzles_list_filter ON puzzles 
    (is_public, puzzle_type, pid_numeric DESC)
    WHERE is_public = true;

-- Index on public puzzles by upload date
CREATE INDEX IF NOT EXISTS idx_puzzles_public_uploaded ON puzzles 
    (is_public, uploaded_at DESC)
    WHERE is_public = true;

-- ============================================================================
-- PHASE 8: Rename content to puzzle_data
-- ============================================================================

-- First, drop the trigger that references the old column name
DROP TRIGGER IF EXISTS sync_clues_trigger ON puzzles;

-- Rename the column
ALTER TABLE public.puzzles RENAME COLUMN content TO puzzle_data;

-- Recreate the trigger with the new column name
CREATE TRIGGER sync_clues_trigger
    AFTER INSERT OR UPDATE OF puzzle_data ON puzzles
    FOR EACH ROW
    EXECUTE FUNCTION sync_puzzle_clues();

-- ============================================================================
-- PHASE 9: Set NOT NULL constraints (after data is migrated)
-- ============================================================================

-- Only set NOT NULL on columns that should always have values
ALTER TABLE public.puzzles
ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.puzzles
ALTER COLUMN author SET NOT NULL;

-- Width and height should not be NULL for valid puzzles
ALTER TABLE public.puzzles
ALTER COLUMN width SET NOT NULL;

ALTER TABLE public.puzzles
ALTER COLUMN height SET NOT NULL;

-- Add CHECK constraints for dimensions
ALTER TABLE public.puzzles
ADD CONSTRAINT puzzles_width_positive CHECK (width > 0);

ALTER TABLE public.puzzles
ADD CONSTRAINT puzzles_height_positive CHECK (height > 0);

-- ============================================================================
-- PHASE 10: Clean up old indexes that are now redundant
-- ============================================================================

-- Note: We keep the old indexes temporarily for rollback safety
-- These can be dropped in a future migration after verification:
-- - puzzle_name_and_title_trigrams (replaced by idx_puzzles_title_author_trgm)
-- - puzzle_ipuz_title_author_trigrams (replaced by idx_puzzles_title_author_trgm)
-- - puzzle_combined_title_author_trigrams (replaced by idx_puzzles_title_author_trgm)
-- - puzzles_solution_length_idx (replaced by idx_puzzles_type)

-- Comment: To drop old indexes, run:
-- DROP INDEX IF EXISTS puzzle_name_and_title_trigrams;
-- DROP INDEX IF EXISTS puzzle_ipuz_title_author_trigrams;
-- DROP INDEX IF EXISTS puzzle_combined_title_author_trigrams;
-- DROP INDEX IF EXISTS puzzles_solution_length_idx;

-- ============================================================================
-- Summary of changes:
-- ============================================================================
-- 
-- New columns added to puzzles table:
--   - title TEXT NOT NULL
--   - author TEXT NOT NULL
--   - copyright TEXT
--   - notes TEXT
--   - version TEXT
--   - kind TEXT[]
--   - width INTEGER NOT NULL
--   - height INTEGER NOT NULL
--   - puzzle_type TEXT (GENERATED)
--   - updated_at TIMESTAMP
--
-- Column renamed:
--   - content -> puzzle_data
--
-- New table created:
--   - puzzle_clues (id, pid, clue_number, direction, clue_text, cell_positions)
--
-- New indexes:
--   - idx_puzzles_title_author_trgm (trigram search)
--   - idx_puzzles_type (size filtering)
--   - idx_puzzles_list_filter (composite for list queries)
--   - idx_puzzles_public_uploaded (date sorting)
--   - idx_puzzle_clues_pid (clue lookup)
--   - idx_puzzle_clues_text_search (clue text search)
--
-- Trigger:
--   - sync_clues_trigger (auto-syncs puzzle_clues on insert/update)




