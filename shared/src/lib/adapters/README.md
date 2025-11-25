# XWord Parser Adapters

This directory contains adapters for converting between the standardized `@xwordly/xword-parser` format and the internal application formats.

## Overview

The `@xwordly/xword-parser` library provides a unified `Puzzle` format that supports multiple crossword file formats (PUZ, iPUZ, JPZ, XD). These adapters bridge the gap between that standardized format and our internal formats.

**Why xword-parser?**

- ✅ Standardized format across multiple file types
- ✅ Better maintenance (actively maintained library)
- ✅ Supports more formats (PUZ, iPUZ v1/v2, JPZ, XD)
- ✅ Better error handling
- ✅ TypeScript support
- ✅ Lazy loading for optimal bundle size

## Adapters

### `xwordParserAdapter.ts`

Main adapter for converting between formats:

- **`puzzleToGameJson(puzzle: Puzzle): GameJson`** - Converts xword-parser `Puzzle` to internal `GameJson` format used for gameplay
- **`puzzleToPuzzleJson(puzzle: Puzzle): PuzzleJson`** - Converts xword-parser `Puzzle` to `PuzzleJson` (ipuz format) for database storage
- **`puzzleJsonToPuzzle(puzzleJson: PuzzleJson): Puzzle`** - Converts stored `PuzzleJson` to xword-parser `Puzzle` format

### `gameJsonToPuzzle.ts`

Reverse adapter for converting internal game format back to standard format:

- **`gameJsonToPuzzle(gameJson: GameJson): Puzzle`** - Converts internal `GameJson` back to xword-parser `Puzzle` format (useful for export)

## Usage

### Parsing Files

```typescript
import {parseLazy} from '@xwordly/xword-parser/lazy';
import {puzzleToPuzzleJson} from '@crosswithfriends/shared/lib/adapters/xwordParserAdapter';

// Parse a file (lazy loading for better bundle size)
const puzzle = await parseLazy(fileData, {filename: 'puzzle.ipuz'});

// Convert to PuzzleJson for storage
const puzzleJson = puzzleToPuzzleJson(puzzle);
```

### Converting from Database

```typescript
import {puzzleJsonToPuzzle, puzzleToGameJson} from '@crosswithfriends/shared/lib/adapters/xwordParserAdapter';

// Convert PuzzleJson from database to Puzzle format
const puzzle = puzzleJsonToPuzzle(puzzleJson);

// Convert to GameJson for gameplay
const gameJson = puzzleToGameJson(puzzle);
```

## Format Support

- **iPUZ v1**: Clues as `[["1", "clue text"], ...]`
- **iPUZ v2**: Clues as `[{number: "1", clue: "clue text", cells: [...]}, ...]`
- **Puzzle Grid**: Supports string clue numbers (`"1"`, `"10"`), number clue numbers, `"0"` for empty cells, `"#"` for black squares, and cell objects with styles

## Notes

- **Shades**: xword-parser doesn't support shades directly. They are extracted separately from `PuzzleJson` when needed.
- **Circles**: Supported via `isCircled` property in xword-parser `Cell` format
- **Empty Cells**: In ipuz v2, `"0"` represents empty cells (no clue number). The adapter handles this correctly.
- **Rebus**: xword-parser supports rebus via `hasRebus` and `rebusKey` properties on `Cell`, and `rebusTable` on `Puzzle`. Currently, rebus information is preserved in the solution but not explicitly handled in the adapters. This can be extended if needed.
- **Validation**: All adapter functions validate input before conversion and throw descriptive errors if the puzzle is invalid.

## Error Handling

All adapter functions include validation and will throw errors with descriptive messages:

```typescript
try {
  const gameJson = puzzleToGameJson(puzzle);
} catch (error) {
  // Error messages include:
  // - "Puzzle has an empty grid"
  // - "Invalid puzzle dimensions: 0x0"
  // - "Puzzle has no clues"
  console.error('Conversion failed:', error.message);
}
```

## Migration

Legacy converters (`PUZtoIPUZ.js`, `iPUZtoJSON.js`) are deprecated but kept for backward compatibility during migration. They will be removed in a future version once all PUZ file parsing is migrated to xword-parser.

## Performance

- **Lazy Loading**: Use `parseLazy` from `@xwordly/xword-parser/lazy` for optimal bundle size
- **Tree Shaking**: Vite automatically tree-shakes unused format parsers
- **Type Safety**: Full TypeScript support with strict type checking
