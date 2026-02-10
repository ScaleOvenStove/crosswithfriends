-- Migration: Add content_hash column for duplicate puzzle detection
-- Run manually against each environment (local, testing, prod)
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS puzzles_content_hash_public
  ON puzzles (content_hash) WHERE is_public = true AND content_hash IS NOT NULL;
