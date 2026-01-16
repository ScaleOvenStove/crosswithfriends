-- Migration: 007_fix_game_events_schema.sql
-- Fixes schema issues in game_events table:
-- 1. Add primary key
-- 2. Add NOT NULL constraints to gid and uid
-- 3. Change json to jsonb for better indexing and performance
-- 4. Add foreign key constraint to puzzles table (if applicable)
-- Step 1: Add a serial primary key column
-- First, check if id column already exists
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'game_events'
        AND column_name = 'id'
) THEN
ALTER TABLE public.game_events
ADD COLUMN id SERIAL;
END IF;
END $$;
-- Step 2: Make id the primary key (if not already)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'game_events'
        AND constraint_type = 'PRIMARY KEY'
) THEN
ALTER TABLE public.game_events
ADD PRIMARY KEY (id);
END IF;
END $$;
-- Step 3: Convert json to jsonb
-- First, add a new jsonb column
ALTER TABLE public.game_events
ADD COLUMN IF NOT EXISTS event_payload_jsonb jsonb;
-- Copy data from json to jsonb
UPDATE public.game_events
SET event_payload_jsonb = event_payload::jsonb
WHERE event_payload_jsonb IS NULL;
-- Drop the old json column
ALTER TABLE public.game_events DROP COLUMN IF EXISTS event_payload;
-- Rename jsonb column to original name
ALTER TABLE public.game_events
    RENAME COLUMN event_payload_jsonb TO event_payload;
-- Step 4: Add NOT NULL constraints
-- First, update any NULL gid values (shouldn't exist, but be safe)
UPDATE public.game_events
SET gid = ''
WHERE gid IS NULL;
-- Add NOT NULL constraint to gid
ALTER TABLE public.game_events
ALTER COLUMN gid
SET NOT NULL;
-- For uid, we'll allow NULL (users may not always be authenticated in legacy data)
-- But we can add a check constraint to ensure it's either NULL or non-empty
ALTER TABLE public.game_events
ADD CONSTRAINT game_events_uid_check CHECK (
        uid IS NULL
        OR length(trim(uid)) > 0
    );
-- Step 5: Add index on event_payload for better query performance (jsonb supports GIN indexes)
CREATE INDEX IF NOT EXISTS game_events_event_payload_gin_idx ON public.game_events USING GIN (event_payload);
-- Step 6: Add index on event_type for filtering by event type
CREATE INDEX IF NOT EXISTS game_events_event_type_idx ON public.game_events (event_type);
-- Note: Foreign key to puzzles table is not added because:
-- 1. The pid is stored inside event_payload, not as a direct column
-- 2. Adding a foreign key would require extracting pid to a separate column
-- 3. This can be done in a future migration if needed



