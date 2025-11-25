# Code Issues and Partial Implementations

## Fixed Issues ✅

### 1. `getPuzzleInfo` doesn't handle old format

**Location:** `server/model/puzzle.ts:277-289`
**Issue:** Only extracted from ipuz format, but database has puzzles in old format with `info` object
**Fix:** Added support for both formats (old format with `info` object and new ipuz format)
**Impact:** Used in `server/api/game.ts` for game info endpoint

### 2. Empty search filter handling

**Location:** `server/model/puzzle.ts:61`
**Issue:** Empty search strings would create filters with empty patterns
**Fix:** Filter out empty strings before creating search patterns
**Impact:** More efficient queries when search is empty

## Known Issues / TODOs

### Frontend TODOs

1. **FileUploader circular dependency warning** (Not a real issue)
   - **Location:** `frontend/src/components/Upload/FileUploader.tsx:85-111`
   - **Status:** Uses ref pattern to avoid circular dependency - this is intentional
   - **Note:** Linter warning is a false positive

2. **Fencing component TODOs**
   - **Location:** `frontend/src/components/Fencing/usePlayerActions.ts:9,28`
   - **Issues:**
     - `addPing()` marked as TODO
     - Auto-check cooldown logic needs setTimeout
   - **Impact:** Minor feature gaps

3. **Authentication TODOs**
   - **Location:** `frontend/src/routes/index.tsx:117,155,160`
   - **Issues:**
     - Auth not implemented
     - Beta access check not implemented
   - **Impact:** Security/auth features missing

4. **Performance TODOs**
   - **Location:** `frontend/src/components/Game/Game.tsx:138`
   - **Issue:** Should be cached
   - **Impact:** Potential performance issue

5. **Type safety issues**
   - **Location:** Multiple files in `frontend/src`
   - **Issues:** Many `any` types used, especially in:
     - `FileUploader.tsx` - puzzle types
     - `PuzzleList.tsx` - userHistory, sizeFilter, statusFilter
     - `useGame.ts` - gameState
   - **Impact:** Reduced type safety

### Backend Issues

1. **Type assertion in game endpoint**
   - **Location:** `server/api/game.ts:42`
   - **Issue:** Uses `as InfoJson` type assertion
   - **Impact:** Type safety concern, but should work with fix to `getPuzzleInfo`

## Partial Implementations

1. **Puzzle format migration**
   - **Status:** Code supports both formats, but database migration not run
   - **Location:** `server/sql/migrate_puzzles_to_ipuz_format.sql`
   - **Impact:** Database has mixed formats (handled by code)

2. **Index supports both formats**
   - **Status:** SQL index expects old format, but queries handle both
   - **Location:** `server/sql/create_puzzles.sql:30`
   - **Impact:** Index may not be fully utilized for new format puzzles

## Recommendations

### High Priority

1. ✅ Fix `getPuzzleInfo` to handle old format (DONE)
2. ✅ Fix empty search filter handling (DONE)
3. Consider running database migration when ready
4. Update SQL index to support both formats (or migrate fully)

### Medium Priority

1. Add proper types to replace `any` in frontend
2. Implement authentication if needed
3. Add caching for performance-critical paths

### Low Priority

1. Complete Fencing component TODOs
2. Clean up HACK comments in codebase
3. Remove debug code in production builds
