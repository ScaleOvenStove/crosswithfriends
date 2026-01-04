import type {Brand} from 'utility-types';

export interface InfoJson {
  type?: string; // this is sometimes set by the frontend, e.g. by the FileUpload module
  title: string;
  author: string;
  copyright: string;
  description: string;
}

export interface CluesJson {
  across: string[];
  down: string[];
}

export interface CellData {
  value?: string;
  black?: boolean;
  number?: number;
  revealed?: boolean;
  bad?: boolean;
  good?: boolean;
  pencil?: boolean;
  isHidden?: boolean; // used for fencing mode; if true, then player cannot access the cell at all
  solvedBy?: {
    id: string;
    teamId: number;
  };
  parents?: {
    across: number;
    down: number;
  };
}
export type GridData = CellData[][];

export type CellIndex = Brand<number, 'CellIndex'>;
export const toCellIndex = (r: number, c: number, cols: number) => (r * cols + c) as CellIndex;

export interface GameJson {
  info: InfoJson;
  grid: GridData;
  teamGrids?: Record<number, GridData>; // TODO move to fencingState.teams[number].grid
  teamClueVisibility?: Record<
    number,
    {
      across: boolean[]; // true --> visible, false --> hidden
      down: boolean[];
    }
  >;
  solution: string[][];
  clues: CluesJson;
  circles?: CellIndex[];
  shades?: CellIndex[];
}

export interface UserJson {
  id: string;
  cursor?: Cursor;
  displayName: string;
  teamId?: number;
  score?: number;
  misses?: number;
}

export interface Cursor {
  id: string;
  r: number; // Row in puzzle
  c: number; // Column in puzzle
  timestamp: number;
  color?: string;
  active?: boolean;
  displayName?: string;
}

/**
 * PuzzleJson: ipuz format JSON stored in the db (both firebase & postgres)
 * This is the standard ipuz format for crossword puzzles
 */

export interface IpuzCell {
  cell: number; // clue number
  style?: {
    shapebg?: string; // e.g., 'circle'
    fillbg?: string; // e.g., '#000000' for shades
  };
}

export interface PuzzleJson {
  version: string; // e.g., "http://ipuz.org/v1"
  kind: string[]; // e.g., ["http://ipuz.org/crossword#1"]
  dimensions: {
    width: number;
    height: number;
  };
  title: string;
  author: string;
  copyright?: string;
  notes?: string; // description
  solution: (string | null)[][]; // null for black squares, "#" also valid
  puzzle: (number | string | IpuzCell | null)[][]; // clue numbers, "#" for black, objects with cell+style, or null
  clues: {
    Across: Array<{number: string; clue: string}>;
    Down: Array<{number: string; clue: string}>;
  };
}

export interface PuzzleStatsJson {
  numSolves: number;
}

export interface ListPuzzleRequestFilters {
  sizeFilter: {
    Mini: boolean;
    Standard: boolean;
  };
  nameOrTitleFilter: string;
}

export type CellCoords = {r: number; c: number};
