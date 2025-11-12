/**
 * Type definitions for game state and game data
 */

export interface GameInfo {
  title: string;
  type: string;
  author: string;
  [key: string]: unknown;
}

export interface GameCell {
  r: number;
  c: number;
  value: string;
  color?: string;
  pencil?: boolean;
}

export interface GameClock {
  totalTime: number;
  startTime?: number;
  paused?: boolean;
}

export interface GameUser {
  id: string;
  name: string;
  color: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  username: string;
  id: string;
  text: string;
  timestamp: number;
}

export interface GameChat {
  messages: ChatMessage[];
}

export interface GameState {
  pid?: string;
  gid: string;
  info?: GameInfo;
  grid?: unknown[][];
  clues?: {
    across: unknown[];
    down: unknown[];
  };
  users: Record<string, GameUser>;
  chat?: GameChat;
  clock?: GameClock;
  solved?: boolean;
  [key: string]: unknown;
}

// BattleData moved to rawGame.ts to avoid circular dependencies

