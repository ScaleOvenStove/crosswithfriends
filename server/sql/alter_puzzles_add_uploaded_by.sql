-- Add uploaded_by column to track which user uploaded each puzzle.
-- Run this migration on existing databases before deploy.

ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS puzzles_uploaded_by_idx
  ON puzzles (uploaded_by) WHERE uploaded_by IS NOT NULL;
