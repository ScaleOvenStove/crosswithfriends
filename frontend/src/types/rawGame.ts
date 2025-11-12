/**
 * Type definitions for raw game data (before processing)
 */

import type {GameInfo} from './game';

export interface RawGame {
  info?: GameInfo;
  grid?: unknown[][];
  solution?: string[][];
  circles?: Array<{r: number; c: number}>;
  shades?: Array<{r: number; c: number}>;
  chat?: {
    messages?: unknown[];
    users?: unknown[];
  };
  cursor?: Record<string, unknown>;
  clues?: {
    across?: unknown[];
    down?: unknown[];
  };
  clock?: {
    lastUpdated?: number;
    totalTime?: number;
    paused?: boolean;
  };
  solved?: boolean;
  themeColor?: string;
  pid?: number | string;
  [key: string]: unknown;
}

export interface BattleData {
  bid: number;
  team: number;
  [key: string]: unknown;
}

