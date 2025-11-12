/**
 * Type definitions for composition data and events
 */

import type {GameInfo} from './game';

export interface CompositionEvent {
  id?: string;
  timestamp: number | object; // Firebase server timestamp
  type: string;
  params: Record<string, unknown>;
}

export interface CompositionCreateEvent extends CompositionEvent {
  type: 'create';
  params: {
    version: number;
    composition: RawComposition;
  };
}

export interface RawComposition {
  info?: GameInfo;
  grid?: Array<Array<{value: string; [key: string]: unknown}>>;
  clues?: unknown[];
  circles?: Array<{r: number; c: number}>;
  chat?: {
    messages?: unknown[];
    users?: unknown[];
  };
  cursor?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CompositionImportContents {
  info?: GameInfo;
  grid?: unknown[][];
  circles?: Array<{r: number; c: number}>;
  clues?: {
    across?: string[];
    down?: string[];
  };
  [key: string]: unknown;
}

export interface CompositionGrid {
  [key: string]: unknown;
}

