# Puzzle Format Migration Guide

## Overview

The database contains puzzles in two formats:

1. **Old format**: Has an `info` object with `title`, `author`, `type`, etc.
2. **New format (ipuz)**: Has `title`, `author`, `copyright`, `notes` at root level (standard ipuz format)

New puzzles are added in ipuz format, but existing puzzles may still be in the old format.

## Migration Strategy

### Option 1: Full Migration (Recommended for clean state)

Run the migration script to convert all old format puzzles to ipuz format:

```bash
psql -d dfac -f server/sql/migrate_puzzles_to_ipuz_format.sql
```

**Pros:**

- Single format in database
- Simpler queries
- Standard ipuz format

**Cons:**

- Requires downtime or careful coordination
- Need to verify all puzzles migrated correctly

### Option 2: Gradual Migration (Current approach)

Keep both formats and migrate on read/write:

- **Read**: Code handles both formats (already implemented)
- **Write**: New puzzles are in ipuz format
- **Migration**: Convert puzzles when they're accessed or updated

**Pros:**

- No downtime
- Safe, gradual migration
- Can verify each puzzle

**Cons:**

- More complex code
- Database has mixed formats
- Need to maintain compatibility code

### Option 3: Hybrid Approach

1. Keep backward compatibility in code (current state)
2. Run migration script during low-traffic period
3. Remove old format support after verification

## Current Implementation

The codebase currently supports both formats:

1. **Query (`server/model/puzzle.ts`)**: Checks both `content->'info'->>'title'` and `content->>'title'`
2. **API Response (`server/api/puzzle_list.ts`)**: Returns puzzles with `info` object for frontend compatibility
3. **Frontend**: Handles both formats

## Migration Steps

1. **Backup database** (always do this first!)

   ```bash
   pg_dump dfac > puzzles_backup_$(date +%Y%m%d).sql
   ```

2. **Test migration on staging** first

   ```bash
   psql -d dfac_staging -f server/sql/migrate_puzzles_to_ipuz_format.sql
   ```

3. **Verify results**
   - Check puzzle counts
   - Test API endpoints
   - Verify frontend displays correctly

4. **Run on production** during maintenance window

5. **Monitor** for any issues

6. **Clean up** old format support code after verification period

## Rollback Plan

If migration causes issues:

1. Restore from backup
2. Revert code changes
3. Investigate issues

## Index Update

The migration script updates the trigram index to support both formats using `COALESCE`. After full migration, you can simplify the index to only check ipuz format:

```sql
DROP INDEX puzzle_name_and_title_trigrams;
CREATE INDEX puzzle_name_and_title_trigrams
  ON public.puzzles USING GIST (
    ((content->>'title') || ' ' || (content->>'author')) gist_trgm_ops
  );
```
