-- Script to remove puzzles with empty clues from the database
-- Run with: psql $DATABASE_URL -f scripts/remove-bad-puzzles.sql

-- First, show what will be deleted
SELECT 
  pid, 
  content->'clues' as clues,
  CASE 
    WHEN content->'clues' IS NULL THEN 'No clues object'
    WHEN (content->'clues'->'Across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Across', '[]'::jsonb)) = 0)
         AND (content->'clues'->'Down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Down', '[]'::jsonb)) = 0)
         AND (content->'clues'->'across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'across', '[]'::jsonb)) = 0)
         AND (content->'clues'->'down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'down', '[]'::jsonb)) = 0)
    THEN 'All clue arrays empty'
    ELSE 'Other'
  END as reason
FROM puzzles
WHERE 
  content->'clues' IS NULL
  OR (
    (content->'clues'->'Across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Across', '[]'::jsonb)) = 0)
    AND (content->'clues'->'Down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Down', '[]'::jsonb)) = 0)
    AND (content->'clues'->'across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'across', '[]'::jsonb)) = 0)
    AND (content->'clues'->'down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'down', '[]'::jsonb)) = 0)
  );

-- Delete the puzzles with empty clues
DELETE FROM puzzles
WHERE 
  content->'clues' IS NULL
  OR (
    (content->'clues'->'Across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Across', '[]'::jsonb)) = 0)
    AND (content->'clues'->'Down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'Down', '[]'::jsonb)) = 0)
    AND (content->'clues'->'across' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'across', '[]'::jsonb)) = 0)
    AND (content->'clues'->'down' IS NULL OR jsonb_array_length(COALESCE(content->'clues'->'down', '[]'::jsonb)) = 0)
  );




