/**
 * Type definitions for game events and socket events
 */

// Base event structure
export interface BaseEvent {
  id: string;
  timestamp: number | string;
  type: string;
  params?: Record<string, unknown>;
}

// Game event types
export type GameEventType =
  | 'create'
  | 'updateCell'
  | 'updateCursor'
  | 'addPing'
  | 'updateDisplayName'
  | 'updateColor'
  | 'updateClock'
  | 'check'
  | 'reveal'
  | 'reset'
  | 'chat';

// Discriminated union for game events
export interface CreateEvent extends BaseEvent {
  type: 'create';
  params: {
    grid: unknown;
    clues: unknown;
    info: {
      title: string;
      type: string;
      author: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface UpdateCellEvent extends BaseEvent {
  type: 'updateCell';
  params: {
    cell: {r: number; c: number};
    value: string;
    color: string;
    pencil: boolean;
    id: string;
    autocheck: boolean;
  };
}

export interface UpdateCursorEvent extends BaseEvent {
  type: 'updateCursor';
  params: {
    timestamp: number | string;
    cell: {r: number; c: number};
    id: string;
  };
}

export interface AddPingEvent extends BaseEvent {
  type: 'addPing';
  params: {
    timestamp: number | string;
    cell: {r: number; c: number};
    id: string;
  };
}

export interface UpdateDisplayNameEvent extends BaseEvent {
  type: 'updateDisplayName';
  params: {
    id: string;
    displayName: string;
  };
}

export interface UpdateColorEvent extends BaseEvent {
  type: 'updateColor';
  params: {
    id: string;
    color: string;
  };
}

export interface UpdateClockEvent extends BaseEvent {
  type: 'updateClock';
  params: {
    action: 'start' | 'pause' | 'resume' | 'stop';
  };
}

export interface CheckEvent extends BaseEvent {
  type: 'check';
  params: {
    scope: 'grid' | 'word' | 'puzzle';
  };
}

export interface RevealEvent extends BaseEvent {
  type: 'reveal';
  params: {
    scope: 'grid' | 'word' | 'puzzle';
  };
}

export interface ResetEvent extends BaseEvent {
  type: 'reset';
  params: {
    scope: 'grid' | 'word' | 'puzzle';
    force?: boolean;
  };
}

export interface ChatEvent extends BaseEvent {
  type: 'chat';
  params: {
    username: string;
    id: string;
    text: string;
  };
}

// Union type for all game events
export type GameEvent =
  | CreateEvent
  | UpdateCellEvent
  | UpdateCursorEvent
  | AddPingEvent
  | UpdateDisplayNameEvent
  | UpdateColorEvent
  | UpdateClockEvent
  | CheckEvent
  | RevealEvent
  | ResetEvent
  | ChatEvent;

// Socket event types
export interface SocketGameEvent {
  event: GameEvent;
  gid: string;
}

export interface SocketRoomEvent {
  rid: string;
  event: RoomEvent;
}

// Room event types
export type RoomEventType = 'user_ping' | 'set_game';

export interface BaseRoomEvent {
  type: RoomEventType;
  timestamp: number;
  uid: string;
}

export interface UserPingRoomEvent extends BaseRoomEvent {
  type: 'user_ping';
}

export interface SetGameRoomEvent extends BaseRoomEvent {
  type: 'set_game';
  gid: string;
}

export type RoomEvent = UserPingRoomEvent | SetGameRoomEvent;

// Type guards
export function isCreateEvent(event: GameEvent): event is CreateEvent {
  return event.type === 'create';
}

export function isUpdateCellEvent(event: GameEvent): event is UpdateCellEvent {
  return event.type === 'updateCell';
}

export function isChatEvent(event: GameEvent): event is ChatEvent {
  return event.type === 'chat';
}

