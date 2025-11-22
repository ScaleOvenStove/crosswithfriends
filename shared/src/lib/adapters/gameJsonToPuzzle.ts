/**
 * Adapter to convert internal GameJson format back to xword-parser Puzzle format
 *
 * This is useful for exporting puzzles or converting back to standard format
 */

import type {Puzzle, Grid, Cell, Clue} from '@xwordly/xword-parser';
import type {GameJson, CellData} from '../../shared/types';

/**
 * Converts internal GameJson format to xword-parser Puzzle format
 *
 * @param gameJson - The game in internal format
 * @returns The puzzle in xword-parser format
 */
export function gameJsonToPuzzle(gameJson: GameJson): Puzzle {
  const height = gameJson.grid.length;
  const width = gameJson.grid[0]?.length || 0;

  // Convert grid cells
  const cells: Cell[][] = gameJson.grid.map((row) => row.map((cellData) => convertCellDataToCell(cellData)));

  // Build grid
  const grid: Grid = {
    width,
    height,
    cells,
  };

  // Convert clues
  const clues = {
    across: convertCluesArray(gameJson.clues.across),
    down: convertCluesArray(gameJson.clues.down),
  };

  // Build puzzle object
  const puzzle: Puzzle = {
    title: gameJson.info.title,
    author: gameJson.info.author,
    copyright: gameJson.info.copyright,
    notes: gameJson.info.description,
    grid,
    clues,
  };

  // Add circles if present
  if (gameJson.circles) {
    gameJson.circles.forEach((cellIndex) => {
      const row = Math.floor(cellIndex / width);
      const col = cellIndex % width;
      if (cells[row]?.[col]) {
        cells[row]![col]!.isCircled = true;
      }
    });
  }

  return puzzle;
}

/**
 * Converts CellData to xword-parser Cell format
 */
function convertCellDataToCell(cellData: CellData): Cell {
  return {
    solution: cellData.value || undefined,
    isBlack: cellData.black ?? false,
    number: cellData.number,
    isCircled: false, // Will be set separately if in circles array
  };
}

/**
 * Converts internal clue array format to xword-parser Clue[] format
 * Internal format: string[] indexed by clue number
 * xword-parser format: Clue[] with {number, text}
 */
function convertCluesArray(cluesArray: string[]): Clue[] {
  const result: Clue[] = [];
  for (let i = 0; i < cluesArray.length; i++) {
    const text = cluesArray[i];
    if (text !== undefined && text !== '') {
      result.push({
        number: i,
        text,
      });
    }
  }
  return result;
}
