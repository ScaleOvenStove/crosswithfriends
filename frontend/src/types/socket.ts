/**
 * Type definitions for socket events and socket client
 */

import type {GameEvent, SocketGameEvent, SocketRoomEvent} from './events';

// Re-export Socket type for convenience
export type {Socket} from 'socket.io-client';

// Socket event names
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  GAME_EVENT: 'game_event',
  ROOM_EVENT: 'room_event',
  PING: 'ping',
  PONG: 'pong',
} as const;

// Socket event handler types
export type SocketEventHandler<T = unknown> = (data: T) => void;

// Typed socket event handlers
export interface TypedSocketHandlers {
  connect: SocketEventHandler<void>;
  disconnect: SocketEventHandler<string>;
  game_event: SocketEventHandler<GameEvent>;
  room_event: SocketEventHandler<SocketRoomEvent>;
  ping: SocketEventHandler<void>;
  pong: SocketEventHandler<number>;
}

// Socket emit event types
export interface SocketEmitEvents {
  [key: string]: (...args: unknown[]) => void;
}

// Specific emit event signatures (for type checking when known)
export interface KnownSocketEmitEvents {
  join_game: (gid: string) => void;
  game_event: (data: SocketGameEvent) => void;
  room_event: (data: SocketRoomEvent) => void;
  sync_all_game_events: (gid: string) => void;
}

