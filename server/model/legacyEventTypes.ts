/**
 * Legacy event parameter types from the old gameStore.ts implementation
 * These are maintained for backward compatibility with existing games
 */

// Legacy event parameter types
export interface LegacyUpdateCellParams {
  cell: {r: number; c: number};
  value: string;
  color: string;
  pencil: boolean;
  id: string;
  autocheck: boolean;
}

export interface LegacyUpdateCursorParams {
  timestamp: number;
  cell: {r: number; c: number};
  id: string;
}

export interface LegacyAddPingParams {
  timestamp: number;
  cell: {r: number; c: number};
  id: string;
}

export interface LegacyUpdateColorParams {
  id: string;
  color: string;
}

export interface LegacyUpdateClockParams {
  action: string;
  timestamp: number;
}

export interface LegacyCheckParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
}

export interface LegacyRevealParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
}

export interface LegacyResetParams {
  scope: string | {r: number; c: number}[]; // Can be string or array
  force: boolean;
}

export interface LegacyChatParams {
  text: string;
  senderId: string;
  sender: string;
}

export interface LegacySendChatMessageParams {
  message: string;
  id: string;
  sender: string;
}
