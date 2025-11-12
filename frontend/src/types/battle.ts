/**
 * Type definitions for battle-related data structures
 */

export interface Powerup {
  type: string;
  used?: number;
  target?: number;
}

export interface Winner {
  team: number;
  completedAt: number;
}

export interface BattlePlayer {
  name: string;
  team: number;
}

export interface Pickup {
  type: string;
  i: number;
  j: number;
  pickedUp?: boolean;
}

export interface BattleData {
  bid: number;
  team: number;
}

export interface ChatMessage {
  timestamp: number;
  sender?: string;
  senderId?: string;
  text?: string;
  message?: string;
  id?: string;
  [key: string]: unknown;
}

