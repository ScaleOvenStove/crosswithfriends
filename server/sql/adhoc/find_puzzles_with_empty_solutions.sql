-- Find puzzles with empty or missing solution arrays
-- Invocation: psql < find_puzzles_with_empty_solutions.sql

-- Find puzzles where solution array is empty or missing
SELECT 
  pid,
  uploaded_at,
  is_public,
  times_solved,
  CASE 
    WHEN content->'solution' IS NULL THEN 'solution field missing'
    WHEN jsonb_array_length(content->'solution') = 0 THEN 'solution array is empty'
    WHEN jsonb_array_length(content->'solution'->0) = 0 THEN 'solution first row is empty'
    ELSE 'other issue'
  END as issue_type,
  jsonb_array_length(content->'solution') as solution_rows,
  CASE 
    WHEN jsonb_array_length(content->'solution') > 0 
    THEN jsonb_array_length(content->'solution'->0)
    ELSE 0
  END as first_row_length
FROM puzzles
WHERE 
  -- Solution field is missing
  content->'solution' IS NULL
  OR 
  -- Solution array is empty
  jsonb_array_length(content->'solution') = 0
  OR
  -- Solution first row is empty
  (jsonb_array_length(content->'solution') > 0 AND jsonb_array_length(content->'solution'->0) = 0)
ORDER BY pid_numeric DESC;

-- Count of problematic puzzles
SELECT 
  COUNT(*) as total_problematic_puzzles,
  COUNT(CASE WHEN content->'solution' IS NULL THEN 1 END) as missing_solution_field,
  COUNT(CASE WHEN jsonb_array_length(content->'solution') = 0 THEN 1 END) as empty_solution_array,
  COUNT(CASE WHEN jsonb_array_length(content->'solution') > 0 AND jsonb_array_length(content->'solution'->0) = 0 THEN 1 END) as empty_first_row
FROM puzzles
WHERE 
  content->'solution' IS NULL
  OR jsonb_array_length(content->'solution') = 0
  OR (jsonb_array_length(content->'solution') > 0 AND jsonb_array_length(content->'solution'->0) = 0);









