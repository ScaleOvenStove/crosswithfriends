/**
 * Shared puzzle utility functions
 * Used by both frontend and server for consistent puzzle data handling
 */

/**
 * Converts ipuz clue format to sparse array indexed by clue number
 * Handles both v1 format: ["1", "clue text"] and v2 format: {number: "1", clue: "clue text"}
 */
export function convertIpuzClues(clueArray: unknown[]): string[] {
  const result: string[] = [];

  clueArray.forEach((item) => {
    if (Array.isArray(item) && item.length >= 2) {
      // v1 format: ["1", "clue text"]
      const num = parseInt(item[0], 10);
      if (!isNaN(num)) {
        result[num] = item[1];
      }
    } else if (item && typeof item === 'object' && 'number' in item && 'clue' in item) {
      // v2 format: {number: "1", clue: "clue text", cells: [...]}
      const itemObj = item as {number: string; clue: string};
      const num = parseInt(itemObj.number, 10);
      if (!isNaN(num)) {
        result[num] = itemObj.clue;
      }
    }
  });

  return result;
}

/**
 * Determines puzzle type based on grid dimensions
 * Mini puzzles are 10x10 or smaller, Daily puzzles are larger
 */
export function getPuzzleType(gridRows: number): 'Mini Puzzle' | 'Daily Puzzle' {
  return gridRows <= 10 ? 'Mini Puzzle' : 'Daily Puzzle';
}
