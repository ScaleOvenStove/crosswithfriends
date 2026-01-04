/**
 * Replay System Types
 * Type definitions for puzzle replay functionality
 */

import type { GameEvent } from '@crosswithfriends/shared/src/shared/fencingGameEvents/types/GameEvent';

// ============================================================================
// Replay Data
// ============================================================================

export interface ReplayData {
  gid: string;
  pid: string;
  title: string;
  author: string;
  startTime: number;
  endTime: number | null;
  events: GameEvent[];
  players: ReplayPlayer[];
}

export interface ReplayPlayer {
  id: string;
  displayName: string;
  color: string;
  teamId?: number;
}

// ============================================================================
// Playback State
// ============================================================================

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'ended';

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface PlaybackState {
  status: PlaybackStatus;
  currentTime: number; // milliseconds since replay start
  speed: PlaybackSpeed;
  currentEventIndex: number;
  totalEvents: number;
  duration: number; // total replay duration in milliseconds
}

// ============================================================================
// Timeline
// ============================================================================

export interface TimelineSegment {
  startTime: number;
  endTime: number;
  eventCount: number;
  playerIds: string[];
  label?: string;
}

export interface TimelineMarker {
  time: number;
  type: 'start' | 'milestone' | 'completion' | 'custom';
  label: string;
  icon?: string;
}

// ============================================================================
// Event Filtering
// ============================================================================

export type EventFilterType = 'all' | 'fills' | 'checks' | 'reveals' | 'chat';

export interface EventFilter {
  type: EventFilterType;
  playerIds?: string[];
  teamIds?: number[];
}

// ============================================================================
// Replay Metadata
// ============================================================================

export interface ReplayMetadata {
  gid: string;
  pid: string;
  title: string;
  author: string;
  duration: number;
  playerCount: number;
  completionTime: number | null;
  createdAt: string;
  thumbnail?: string;
}
