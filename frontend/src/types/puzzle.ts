/**
 * Type definitions for puzzle data
 */

import type {GameInfo} from './game';
import type {RawGame} from './rawGame';

export interface PuzzleData {
  info?: GameInfo;
  grid?: string[][];
  solution?: string[][];
  circles?: Array<{r: number; c: number}>;
  shades?: Array<{r: number; c: number}>;
  clues?: {
    across?: string[];
    down?: string[];
  };
  pid?: number | string;
  [key: string]: unknown;
}

export interface PuzzleSolveStats {
  time_to_solve?: number;
  timestamp?: number;
  [key: string]: unknown;
}

export interface GameListEntry {
  gid: string;
  pid: number;
  [key: string]: unknown;
}

