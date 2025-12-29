/**
 * Core type definitions for Cross with Friends Frontend v2
 * Central export point for all application types
 */

// ============================================================================
// Re-export all type modules
// ============================================================================

export * from './socket';
export * from './replay';
export * from './battle';
export * from './mobile';
export * from './firebase';

// ============================================================================
// Legacy/Basic Types (kept for backward compatibility)
// ============================================================================

export interface User {
  id: string;
  displayName: string;
  color: string;
  isActive: boolean;
}

export interface Cursor {
  id: string;
  row: number;
  col: number;
  timestamp: number;
}

export interface Cell {
  value: string;
  isPencil: boolean;
  isBlack: boolean;
  hasCircle: boolean;
  number?: number;
  isGood?: boolean; // Cell is checked and correct
  isBad?: boolean; // Cell is checked and incorrect
}

export interface GameState {
  id: string;
  puzzleId: string;
  cells: Cell[][];
  users: User[];
  isComplete: boolean;
  startTime?: number;
  endTime?: number;
}

export interface Clue {
  number: number;
  clue: string;
  answer: string;
  direction: 'across' | 'down';
}

export interface Puzzle {
  id: string;
  title: string;
  author: string;
  grid: string[][];
  clues: {
    across: Clue[];
    down: Clue[];
  };
  width: number;
  height: number;
}

export type DarkMode = 'light' | 'dark' | 'system';

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}
