-- Migration: Convert puzzles from old format (with info object) to ipuz format
-- 
-- Old format structure:
-- {
--   "info": {
--     "title": "...",
--     "author": "...",
--     "type": "Daily Puzzle" | "Mini Puzzle",
--     "copyright": "...",
--     "description": "..."
--   },
--   "grid": [...],
--   "solution": [...],
--   "clues": {...},
--   ...
-- }
--
-- New format (ipuz):
-- {
--   "title": "...",
--   "author": "...",
--   "copyright": "...",
--   "notes": "...",
--   "solution": [...],
--   "puzzle": [...],
--   "clues": {...},
--   ...
-- }
--
-- **invocation**: psql dfac < migrate_puzzles_to_ipuz_format.sql
-- Or: psql -d dfac -f migrate_puzzles_to_ipuz_format.sql

-- Step 1: Create a backup of puzzles table (optional but recommended)
-- CREATE TABLE puzzles_backup AS SELECT * FROM puzzles;

-- Step 2: DRY RUN - Preview what will be migrated (run this first!)
-- Uncomment to see what puzzles will be affected:
/*
SELECT 
  pid,
  content->'info'->>'title' as old_title,
  content->'info'->>'author' as old_author,
  content->>'title' as current_title,
  CASE 
    WHEN content->'info' IS NOT NULL AND content->>'title' IS NULL THEN 'needs_migration'
    WHEN content->'info' IS NOT NULL AND content->>'title' IS NOT NULL THEN 'has_both'
    WHEN content->>'title' IS NOT NULL THEN 'already_ipuz'
    ELSE 'unknown'
  END as status
FROM puzzles
WHERE content->'info' IS NOT NULL
LIMIT 20;
*/

-- Step 3: Migrate puzzles that have the old format (info object exists)
-- Only migrate puzzles that have content->'info' but don't have title at root level
-- This preserves all other fields and only moves info fields to root level
UPDATE puzzles
SET content = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        -- Remove the info object
        content - 'info',
        -- Add title at root
        '{title}',
        to_jsonb(COALESCE(content->'info'->>'title', '')::text)
      ),
      -- Add author at root
      '{author}',
      to_jsonb(COALESCE(content->'info'->>'author', '')::text)
    ),
    -- Add copyright at root (if exists)
    '{copyright}',
    CASE 
      WHEN content->'info'->>'copyright' IS NOT NULL AND content->'info'->>'copyright' != ''
      THEN to_jsonb((content->'info'->>'copyright')::text)
      ELSE NULL
    END
  ),
  -- Add notes (description) at root (if exists)
  '{notes}',
  CASE 
    WHEN content->'info'->>'description' IS NOT NULL AND content->'info'->>'description' != ''
    THEN to_jsonb((content->'info'->>'description')::text)
    ELSE NULL
  END
)
WHERE content->'info' IS NOT NULL
  AND content->>'title' IS NULL;  -- Only migrate if not already in ipuz format

-- Step 4: Update the trigram index to support both formats during transition
-- Drop the old index
DROP INDEX IF EXISTS puzzle_name_and_title_trigrams;

-- Create a new index that supports both formats
-- Uses COALESCE to check both old format (info) and new format (root level)
CREATE INDEX puzzle_name_and_title_trigrams
  ON public.puzzles USING GIST (
    (
      COALESCE(
        (content->'info'->>'title') || ' ' || (content->'info'->>'author'),
        (content->>'title') || ' ' || (content->>'author')
      )
    ) gist_trgm_ops
  );

-- Step 5: Verify migration
-- Check how many puzzles were migrated
SELECT 
  COUNT(*) FILTER (WHERE content->'info' IS NOT NULL) as old_format_count,
  COUNT(*) FILTER (WHERE content->>'title' IS NOT NULL AND content->'info' IS NULL) as ipuz_format_count,
  COUNT(*) as total_count
FROM puzzles;

-- Sample a few migrated puzzles to verify
SELECT pid, 
       content->>'title' as title,
       content->>'author' as author,
       CASE 
         WHEN content->'info' IS NOT NULL THEN 'old_format'
         WHEN content->>'title' IS NOT NULL THEN 'ipuz_format'
         ELSE 'unknown'
       END as format
FROM puzzles
LIMIT 10;

