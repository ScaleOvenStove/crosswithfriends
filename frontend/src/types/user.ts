/**
 * Type definitions for user-related data
 */

export interface UserHistoryEntry {
  gid: string;
  pid?: number;
  solved?: boolean;
  timestamp?: number;
  [key: string]: unknown;
}

export interface UserHistory {
  [gid: string]: UserHistoryEntry;
}

export interface CompositionEntry {
  cid: string;
  title: string;
  author: string;
  published?: boolean;
  [key: string]: unknown;
}

export interface UserCompositions {
  [cid: string]: CompositionEntry;
}

