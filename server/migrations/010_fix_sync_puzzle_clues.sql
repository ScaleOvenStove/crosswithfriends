-- Migration: 010_fix_sync_puzzle_clues.sql
-- Fixes the sync_puzzle_clues function to use the correct 'puzzle_data' column
-- This fixes the regression from 008 where 'content' was renamed but the function wasn't updated

CREATE OR REPLACE FUNCTION sync_puzzle_clues()
RETURNS TRIGGER AS $$
DECLARE
    clue_item JSONB;
    clue_num TEXT;
    clue_txt TEXT;
    puzzle_content JSONB;
BEGIN
    -- Use the appropriate column name (content or puzzle_data)
    -- AFTER rename in 008, only puzzle_data exists on NEW
    puzzle_content := NEW.puzzle_data;
    
    IF puzzle_content IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Delete existing clues for this puzzle
    DELETE FROM puzzle_clues WHERE pid = NEW.pid;

    -- Insert Across clues
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
