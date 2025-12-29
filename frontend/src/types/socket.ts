/**
 * Socket Event Types
 * Type definitions for real-time Socket.IO events
 */

import type { GameEvent } from '@crosswithfriends/shared/src/shared/fencingGameEvents/types/GameEvent';

// ============================================================================
// Game Socket Events
// ============================================================================

export interface JoinGamePayload {
  gid: string;
  uid: string;
}

export interface LeaveGamePayload {
  gid: string;
  uid: string;
}

export interface GameEventPayload {
  gid: string;
  event: GameEvent;
}

export interface SyncAllGameEventsPayload {
  gid: string;
}

export interface SyncAllGameEventsResponse {
  events: GameEvent[];
}

export interface SyncRecentGameEventsPayload {
  gid: string;
  since: number; // timestamp
}

export interface SyncRecentGameEventsResponse {
  events: GameEvent[];
}

// ============================================================================
// Room Socket Events
// ============================================================================

export interface JoinRoomPayload {
  rid: string;
  uid: string;
}

export interface LeaveRoomPayload {
  rid: string;
  uid: string;
}

export interface RoomEvent {
  type: 'user_join' | 'user_leave' | 'chat_message' | 'presence_update';
  payload: unknown;
  timestamp: number;
}

export interface RoomEventPayload {
  rid: string;
  event: RoomEvent;
}

export interface SyncAllRoomEventsPayload {
  rid: string;
}

export interface SyncAllRoomEventsResponse {
  events: RoomEvent[];
}

// ============================================================================
// Latency Ping/Pong
// ============================================================================

export interface LatencyPingPayload {
  timestamp: number;
}

export interface LatencyPongPayload {
  timestamp: number;
}

// ============================================================================
// Socket Event Maps (for type-safe emit/on)
// ============================================================================

export interface ServerToClientEvents {
  game_event: (payload: GameEventPayload) => void;
  sync_all_game_events_response: (payload: SyncAllGameEventsResponse) => void;
  sync_recent_game_events_response: (payload: SyncRecentGameEventsResponse) => void;
  room_event: (payload: RoomEventPayload) => void;
  sync_all_room_events_response: (payload: SyncAllRoomEventsResponse) => void;
  latency_pong: (payload: LatencyPongPayload) => void;
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
}

export interface ClientToServerEvents {
  join_game: (payload: JoinGamePayload) => void;
  leave_game: (payload: LeaveGamePayload) => void;
  game_event: (payload: GameEventPayload) => void;
  sync_all_game_events: (payload: SyncAllGameEventsPayload) => void;
  sync_recent_game_events: (payload: SyncRecentGameEventsPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  leave_room: (payload: LeaveRoomPayload) => void;
  room_event: (payload: RoomEventPayload) => void;
  sync_all_room_events: (payload: SyncAllRoomEventsPayload) => void;
  latency_ping: (payload: LatencyPingPayload) => void;
}

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  latency: number | null;
  error: Error | null;
  reconnectAttempts: number;
}
