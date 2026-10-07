export type PuzzleSizeLabel = 'Mini' | 'Midi' | 'Standard' | 'Large' | 'Puzzle';

// Must agree with getPuzzleSizeBucketSql / buildSizeFilterClause in
// server/model/puzzle.ts, which classify puzzles for the size filter. The
// title is the uploader's (not the override), matching content->'info'->>'title'.
export function getPuzzleSizeLabel(
  title: string | undefined,
  grid: ArrayLike<ArrayLike<unknown>> | undefined,
  type?: string
): PuzzleSizeLabel {
  const titleLower = (title || '').toLowerCase();

  // Title-based classification takes priority
  if (/\bmidi\b/.test(titleLower)) return 'Midi';
  if (/\bmini\b/.test(titleLower)) return 'Mini';

  // Fall back to grid size
  if (grid && grid.length) {
    const maxDim = Math.max(grid.length, grid[0]?.length ?? 0);
    if (maxDim <= 8) return 'Mini';
    if (maxDim <= 12) return 'Midi';
    if (maxDim <= 16) return 'Standard';
    return 'Large';
  }
  // Fallback to the upload-time type field if grid not available
  if (type === 'Daily Puzzle') return 'Standard';
  if (type === 'Mini Puzzle') return 'Mini';
  return 'Puzzle';
}
