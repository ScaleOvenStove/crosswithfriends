import * as colors from '@crosswithfriends/shared/lib/colors';
import {reduce as gameReducer} from '@crosswithfriends/shared/lib/reducers/game';
import {ref, onValue, off, get, set} from 'firebase/database';
import {type Socket} from 'socket.io-client';
import * as uuid from 'uuid';
import {create} from 'zustand';

import socketManager from '../sockets/SocketManager';
import type {GameEvent} from '../types/events';
import type {RawGame, BattleData} from '../types/rawGame';
import {logger} from '../utils/logger';

import {db, SERVER_TIME, type DatabaseReference} from './firebase';
import {isValidFirebasePath, extractAndValidateGid} from './firebaseUtils';

// ============ Serialize / Deserialize Helpers ========== //

// Recursively walks obj and converts `null` to `undefined`
const castNullsToUndefined = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return undefined as T;
  }
  if (typeof obj === 'object') {
    return Object.assign(
      (obj as object).constructor(),
      Object.fromEntries(
        Object.keys(obj).map((key) => [key, castNullsToUndefined((obj as Record<string, unknown>)[key])])
      )
    ) as T;
  }
  return obj;
};

const CURRENT_VERSION = 1.0;

// Game cleanup configuration constants
const MAX_GAMES_IN_MEMORY = 10;
const GAME_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const GAME_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

// Subscription tracking (only in development mode to avoid production overhead)
const isDevelopment = import.meta.env.MODE === 'development';

interface SubscriptionTracker {
  path: string;
  event: string;
  callback: (data: unknown) => void;
  createdAt: number;
  lastUsed: number;
}

interface EventArchive {
  archivedEvents: GameEvent[];
  unarchivedAt?: number;
  url?: string;
  compressed?: boolean;
}

interface ConflictState {
  id: string;
  optimisticEvent: GameEvent;
  serverEvent: GameEvent;
  baseState: unknown;
  conflictType: 'simple' | 'complex';
  description: string;
  timestamp: number;
}

interface GameInstance {
  path: string;
  ref: DatabaseReference;
  eventsRef: DatabaseReference;
  createEvent: GameEvent | null;
  socket?: Socket;
  battleData?: unknown;
  ready: boolean; // Whether the game has been initialized and is ready
  events: GameEvent[]; // Recent events (last 1000) for HistoryWrapper compatibility
  archivedEvents?: EventArchive; // Archived older events
  totalEventCount: number; // Total number of events (including archived)
  gameState: RawGame | null; // Computed game state from events (reactive in Zustand)
  optimisticEvents: GameEvent[]; // Optimistic events that haven't been confirmed
  conflicts: ConflictState[]; // Conflicts that need resolution
  subscriptions: Map<string, Set<(data: unknown) => void>>; // Map-based subscription system
  unsubscribeBattleData?: () => void;
  unsubscribeSocket?: () => void;
  lastAccessTime: number; // Timestamp of last access to this game
  createdAt: number; // Timestamp when game was created
  subscriptionTrackers?: SubscriptionTracker[]; // Optional subscription tracking (development only)
}

interface GameStore {
  games: Record<string, GameInstance>;
  getGame: (path: string) => GameInstance;
  attach: (path: string) => Promise<void>;
  detach: (path: string) => void;
  updateCell: (
    path: string,
    r: number,
    c: number,
    id: string,
    color: string,
    pencil: boolean,
    value: string,
    autocheck: boolean
  ) => void;
  updateCursor: (path: string, r: number, c: number, id: string) => void;
  addPing: (path: string, r: number, c: number, id: string) => void;
  updateDisplayName: (path: string, id: string, displayName: string) => void;
  updateColor: (path: string, id: string, color: string) => void;
  updateClock: (path: string, action: string) => void;
  check: (path: string, scope: {r: number; c: number}[]) => void;
  reveal: (path: string, scope: {r: number; c: number}[]) => void;
  reset: (path: string, scope: {r: number; c: number}[], force: boolean) => void;
  chat: (path: string, username: string, id: string, text: string) => void;
  initialize: (path: string, rawGame: RawGame, options?: {battleData?: BattleData}) => Promise<void>;
  subscribe: (path: string, event: string, callback: (data: unknown) => void) => () => void;
  once: (path: string, event: string, callback: (data: unknown) => void) => () => void; // Subscribe once, auto-unsubscribe after first call
  checkArchive: (path: string) => void;
  unarchive: (path: string) => void;
  getEvents: (path: string) => GameEvent[]; // Get all events for HistoryWrapper (recent + archived if loaded)
  getCreateEvent: (path: string) => GameEvent | null; // Get create event
  loadArchivedEvents: (path: string, offset?: number, limit?: number) => Promise<GameEvent[]>; // Load archived events on demand
  syncRecentGameEvents: (path: string, limit?: number) => Promise<GameEvent[]>; // Sync only recent events
  resolveConflict: (path: string, conflictId: string, resolution: 'local' | 'server' | 'merge') => void; // Resolve a conflict
  getConflicts: (path: string) => ConflictState[]; // Get conflicts for a game
  cleanupStaleGames: (maxAge?: number) => void;
  getGameCount: () => number;
  MAX_GAMES_IN_MEMORY: number;
  GAME_CLEANUP_INTERVAL_MS: number;
  GAME_MAX_AGE_MS: number;
  getSubscriptionStats: () => Record<string, {count: number; events: string[]}>;
}

export const useGameStore = create<GameStore>((setState, getState) => {
  // Helper function to update last access time for a game
  const updateAccessTime = (path: string): void => {
    const state = getState();
    const game = state.games[path];
    if (game) {
      setState({
        games: {
          ...state.games,
          [path]: {
            ...game,
            lastAccessTime: Date.now(),
          },
        },
      });
    }
  };

  // Helper function to validate that a create event has a valid grid
  const isValidCreateEvent = (event: GameEvent | null): boolean => {
    if (!event || event.type !== 'create') return false;

    const params = event.params as {game?: {grid?: unknown}} | undefined;
    if (!params || !params.game) return false;

    const grid = params.game.grid;
    // Grid must be an array with at least one row
    if (!Array.isArray(grid) || grid.length === 0) return false;

    // Grid must have at least one column (check first row)
    if (!Array.isArray(grid[0]) || grid[0].length === 0) return false;

    return true;
  };

  // Cache for incremental game state updates
  // Tracks the last computed state and what was used to compute it
  interface GameStateCache {
    createEventId: string | null;
    eventsLength: number;
    optimisticEventsLength: number;
    lastState: RawGame | null;
  }

  // LRU cache implementation for game state cache
  const MAX_CACHE_SIZE = 50;
  const CACHE_CLEANUP_THRESHOLD = 0.8; // Clean when 80% full (40 entries)
  const gameStateCache = new Map<string, GameStateCache>();
  const cacheAccessOrder: string[] = []; // Tracks access order for LRU eviction

  /**
   * Updates cache access order (moves key to end = most recently used)
   */
  const updateCacheAccessOrder = (key: string): void => {
    const index = cacheAccessOrder.indexOf(key);
    if (index !== -1) {
      cacheAccessOrder.splice(index, 1);
    }
    cacheAccessOrder.push(key);
  };

  /**
   * Evicts least recently used cache entries when threshold is exceeded
   */
  const evictCacheIfNeeded = (): void => {
    const currentSize = gameStateCache.size;
    const threshold = Math.floor(MAX_CACHE_SIZE * CACHE_CLEANUP_THRESHOLD);

    if (currentSize >= threshold) {
      const toEvict = currentSize - threshold + 1; // Evict enough to stay under threshold
      const keysToEvict = cacheAccessOrder.splice(0, toEvict);

      logger.debug('Evicting cache entries', {
        evictingCount: keysToEvict.length,
        cacheSizeBefore: currentSize,
        cacheSizeAfter: gameStateCache.size - keysToEvict.length,
      });

      for (const key of keysToEvict) {
        gameStateCache.delete(key);
      }
    }
  };

  // Helper function to compute game state from events with incremental update optimization
  const computeGameState = (game: GameInstance): RawGame | null => {
    if (!game.createEvent) return null;

    // Validate create event before processing
    if (game.createEvent.type === 'create' && !isValidCreateEvent(game.createEvent)) {
      logger.error('computeGameState - Invalid create event, returning null', {path: game.path});
      return null;
    }

    // Check cache for optimization opportunities
    const cache = gameStateCache.get(game.path);
    const createEventId = game.createEvent.id || null;
    const currentEventsLength = game.events.length;
    const currentOptimisticLength = game.optimisticEvents.length;

    // Cache hit: Nothing has changed, return cached state
    if (
      cache &&
      cache.createEventId === createEventId &&
      cache.eventsLength === currentEventsLength &&
      cache.optimisticEventsLength === currentOptimisticLength &&
      cache.lastState
    ) {
      // Update access order for LRU
      updateCacheAccessOrder(game.path);
      logger.debug('computeGameState - Cache hit (no changes)', {
        path: game.path,
        eventsLength: currentEventsLength,
        optimisticEventsLength: currentOptimisticLength,
      });
      return cache.lastState;
    }

    // Incremental update: Only new events added (no optimistic events involved)
    if (
      cache &&
      cache.createEventId === createEventId &&
      cache.eventsLength < currentEventsLength &&
      cache.optimisticEventsLength === 0 &&
      currentOptimisticLength === 0 &&
      cache.lastState
    ) {
      const newEventsCount = currentEventsLength - cache.eventsLength;
      logger.debug('computeGameState - Incremental update', {
        path: game.path,
        newEventsCount,
        oldEventsLength: cache.eventsLength,
        newEventsLength: currentEventsLength,
      });

      // Apply only new events to cached state
      let state = cache.lastState;
      const newEvents = game.events.slice(cache.eventsLength);

      // Sort only the new events
      const sortedNewEvents = [...newEvents].sort((a, b) => {
        const aTime = typeof a.timestamp === 'string' ? parseFloat(a.timestamp) : a.timestamp || 0;
        const bTime = typeof b.timestamp === 'string' ? parseFloat(b.timestamp) : b.timestamp || 0;
        return aTime - bTime;
      });

      // Apply new events
      for (const event of sortedNewEvents) {
        if (event.type !== 'create') {
          state = gameReducer(state, event);
        }
      }

      // Update cache and access order
      const wasNew = !gameStateCache.has(game.path);
      gameStateCache.set(game.path, {
        createEventId,
        eventsLength: currentEventsLength,
        optimisticEventsLength: currentOptimisticLength,
        lastState: state,
      });
      updateCacheAccessOrder(game.path);

      // Evict if needed (only check on new entries to avoid overhead)
      if (wasNew) {
        evictCacheIfNeeded();
      }

      return state;
    }

    // Full recompute: Cache miss or complex state change
    logger.debug('computeGameState - Full recompute', {
      path: game.path,
      reason: cache
        ? {
            createEventChanged: cache.createEventId !== createEventId,
            eventsLengthDecreased: cache.eventsLength > currentEventsLength,
            optimisticEventsChanged: cache.optimisticEventsLength !== currentOptimisticLength,
          }
        : 'no cache',
    });

    // Debug: Log create event structure
    if (game.createEvent.type === 'create') {
      logger.debug('computeGameState - create event structure', {
        path: game.path,
        hasParams: !!game.createEvent.params,
        hasParamsGame: !!(game.createEvent.params as {game?: unknown})?.game,
        paramsGameType: typeof (game.createEvent.params as {game?: unknown})?.game,
        paramsKeys: game.createEvent.params ? Object.keys(game.createEvent.params as object) : [],
        paramsGameKeys: (game.createEvent.params as {game?: Record<string, unknown>})?.game
          ? Object.keys((game.createEvent.params as {game?: Record<string, unknown>}).game!)
          : [],
        hasGrid: !!(game.createEvent.params as {game?: {grid?: unknown}})?.game?.grid,
        gridLength: Array.isArray((game.createEvent.params as {game?: {grid?: unknown}})?.game?.grid)
          ? ((game.createEvent.params as {game?: {grid?: unknown[]}})?.game?.grid?.length ?? 'N/A')
          : 'not array',
      });
    }

    // Start with the create event
    let state = gameReducer(null, game.createEvent);

    // Debug: Log state after reducer
    if (game.createEvent.type === 'create' && state) {
      logger.debug('computeGameState - state after reducer', {
        path: game.path,
        hasGrid: !!state.grid,
        gridLength: Array.isArray(state.grid) ? state.grid.length : 'not array',
        grid0Length: Array.isArray(state.grid) && state.grid[0] ? state.grid[0].length : 'N/A',
      });

      // Defensive check: if grid is empty or invalid, return null
      if (
        !state.grid ||
        !Array.isArray(state.grid) ||
        state.grid.length === 0 ||
        !Array.isArray(state.grid[0]) ||
        state.grid[0].length === 0
      ) {
        logger.error('computeGameState - Invalid grid in state after reducer, returning null', {
          path: game.path,
        });
        return null;
      }
    }

    // Sort events by timestamp to ensure correct order
    const sortedEvents = [...game.events].sort((a, b) => {
      const aTime = typeof a.timestamp === 'string' ? parseFloat(a.timestamp) : a.timestamp || 0;
      const bTime = typeof b.timestamp === 'string' ? parseFloat(b.timestamp) : b.timestamp || 0;
      return aTime - bTime;
    });

    // Apply all events in order (excluding create event which we already applied)
    for (const event of sortedEvents) {
      if (event.type !== 'create') {
        state = gameReducer(state, event);
      }
    }

    // Apply optimistic events (they're already in order)
    for (const event of game.optimisticEvents) {
      state = gameReducer(state, event, {isOptimistic: true});
    }

    // Update cache with new state and access order
    const wasNew = !gameStateCache.has(game.path);
    gameStateCache.set(game.path, {
      createEventId,
      eventsLength: currentEventsLength,
      optimisticEventsLength: currentOptimisticLength,
      lastState: state,
    });
    updateCacheAccessOrder(game.path);

    // Evict if needed (only check on new entries to avoid overhead)
    if (wasNew) {
      evictCacheIfNeeded();
    }

    return state;
  };

  // Helper function to emit events to subscribers
  const emit = (path: string, event: string, data: unknown): void => {
    const state = getState();
    const game = state.games[path];
    if (!game) return;

    const subscribers = game.subscriptions.get(event);
    if (subscribers) {
      const now = Date.now();
      subscribers.forEach((callback) => {
        try {
          callback(data);

          // Update lastUsed timestamp for subscription tracker (development only)
          if (isDevelopment && game.subscriptionTrackers) {
            const tracker = game.subscriptionTrackers.find(
              (t) => t.path === path && t.event === event && t.callback === callback
            );
            if (tracker) {
              tracker.lastUsed = now;
            }
          }
        } catch (error) {
          logger.errorWithException(`Error in subscription callback for ${event}`, error, {path});
        }
      });
    }
  };

  const connectToWebsocket = async (path: string): Promise<void> => {
    const state = getState();
    const game = state.games[path];
    if (!game || game.socket) return;

    const socket = await socketManager.connect();
    const gid = path.substring(6); // Extract gid from path like "/game/39-vosk"

    // Subscribe to socket events using SocketManager for reconnection handling
    const unsubscribeReconnect = socketManager.subscribe('connect', async () => {
      // Re-join game room on reconnect
      await socketManager.emitAsync('join_game', gid);
      emit(path, 'reconnect', undefined);
    });

    // Join game room - this ensures we receive events for this game
    await socketManager.emitAsync('join_game', gid);

    // Update game with socket reference (for backward compatibility and event listeners)
    setState({
      games: {
        ...state.games,
        [path]: {
          ...game,
          socket, // Store socket reference for event listeners
          unsubscribeSocket: () => {
            unsubscribeReconnect();
          },
        },
      },
    });
  };

  /**
   * Checks if two events are for the same resource (for conflict detection)
   */
  const checkSameResource = (event1: GameEvent, event2: GameEvent): boolean => {
    if (event1.type !== event2.type) return false;

    const params1 = event1.params as Record<string, unknown>;
    const params2 = event2.params as Record<string, unknown>;

    // For updateCell events, check if same cell
    if (event1.type === 'updateCell' && event2.type === 'updateCell') {
      const cell1 = params1.cell as {r?: number; c?: number} | undefined;
      const cell2 = params2.cell as {r?: number; c?: number} | undefined;
      return cell1?.r === cell2?.r && cell1?.c === cell2?.c;
    }

    // For other events, check if they have matching identifiers
    // This is a simplified check - can be expanded
    return JSON.stringify(params1) === JSON.stringify(params2);
  };

  /**
   * Determines conflict type (simple vs complex)
   */
  const determineConflictType = (optimistic: GameEvent, server: GameEvent): 'simple' | 'complex' => {
    // Simple conflicts: timestamp differences, minor value changes
    // Complex conflicts: structural changes, multiple field conflicts
    if (optimistic.type === 'updateCell' && server.type === 'updateCell') {
      const optParams = optimistic.params as {value?: string; cell?: unknown};
      const srvParams = server.params as {value?: string; cell?: unknown};

      // If only value differs, it's a simple conflict
      if (JSON.stringify(optParams.cell) === JSON.stringify(srvParams.cell)) {
        return 'simple';
      }
    }

    return 'complex';
  };

  /**
   * Generates user-friendly conflict description
   */
  const generateConflictDescription = (optimistic: GameEvent, server: GameEvent): string => {
    if (optimistic.type === 'updateCell' && server.type === 'updateCell') {
      const optParams = optimistic.params as {cell?: {r?: number; c?: number}; value?: string};
      const srvParams = server.params as {cell?: {r?: number; c?: number}; value?: string};
      return `Cell at row ${optParams.cell?.r}, column ${optParams.cell?.c} was changed both locally (${optParams.value}) and on the server (${srvParams.value}).`;
    }

    return `A conflict occurred between your local change and the server. Both changes affect the same resource.`;
  };

  /**
   * Matches an optimistic event with a server event by comparing their content
   * Returns true if the events match (same type and params, within timestamp tolerance)
   */
  const matchesOptimisticEvent = (optimisticEvent: GameEvent, serverEvent: GameEvent): boolean => {
    // First try exact ID match (fastest)
    if (optimisticEvent.id && serverEvent.id && optimisticEvent.id === serverEvent.id) {
      return true;
    }

    // Match by type
    if (optimisticEvent.type !== serverEvent.type) {
      return false;
    }

    // Match by params content (deep comparison of relevant fields)
    const optimisticParams = optimisticEvent.params as Record<string, unknown> | undefined;
    const serverParams = serverEvent.params as Record<string, unknown> | undefined;

    if (!optimisticParams || !serverParams) {
      return false;
    }

    // For updateCell events, match by cell coordinates, value, autocheck, and user id
    // Note: color and pencil might differ, so we don't match on those
    if (optimisticEvent.type === 'updateCell') {
      const optCell = optimisticParams.cell as {r?: number; c?: number} | undefined;
      const srvCell = serverParams.cell as {r?: number; c?: number} | undefined;
      if (!optCell || !srvCell) {
        return false;
      }
      // Match on the essential fields that uniquely identify the update
      const cellMatch = optCell.r === srvCell.r && optCell.c === srvCell.c;
      const valueMatch = optimisticParams.value === serverParams.value;
      const idMatch = optimisticParams.id === serverParams.id;
      // autocheck might be transformed by server, so we make it optional
      const autocheckMatch =
        optimisticParams.autocheck === serverParams.autocheck ||
        optimisticParams.autocheck === undefined ||
        serverParams.autocheck === undefined;

      return cellMatch && valueMatch && idMatch && autocheckMatch;
    }

    // For check/reveal events, match by scope and user id
    if (optimisticEvent.type === 'check' || optimisticEvent.type === 'reveal') {
      const optScope = optimisticParams.scope as Array<{r?: number; c?: number}> | undefined;
      const srvScope = serverParams.scope as Array<{r?: number; c?: number}> | undefined;
      if (!optScope || !srvScope || optScope.length !== srvScope.length) {
        return false;
      }
      const scopeMatch = optScope.every((opt, i) => opt.r === srvScope[i]?.r && opt.c === srvScope[i]?.c);
      return scopeMatch && optimisticParams.id === serverParams.id;
    }

    // For cursor events, match by cell and user id
    if (optimisticEvent.type === 'updateCursor') {
      const optCell = optimisticParams.cell as {r?: number; c?: number} | undefined;
      const srvCell = serverParams.cell as {r?: number; c?: number} | undefined;
      return (
        optCell?.r === srvCell?.r && optCell?.c === srvCell?.c && optimisticParams.id === serverParams.id
      );
    }

    // For chat events, match by message content and user id
    if (optimisticEvent.type === 'sendChatMessage') {
      return optimisticParams.message === serverParams.message && optimisticParams.id === serverParams.id;
    }

    // For other events, do a shallow comparison of params
    const optKeys = Object.keys(optimisticParams).sort();
    const srvKeys = Object.keys(serverParams).sort();
    if (optKeys.length !== srvKeys.length) {
      return false;
    }
    const paramsMatch = optKeys.every((key) => optimisticParams[key] === serverParams[key]);

    // If params match, we're done
    if (paramsMatch) {
      return true;
    }

    // As a fallback, if timestamps are very close (within 5 seconds) and type matches,
    // and for updateCell events, if the cell and user match, consider it a match
    // This handles cases where the server might transform the event slightly
    if (optimisticEvent.type === 'updateCell') {
      const optTimestamp =
        typeof optimisticEvent.timestamp === 'string'
          ? parseFloat(optimisticEvent.timestamp)
          : optimisticEvent.timestamp || 0;
      const srvTimestamp =
        typeof serverEvent.timestamp === 'string'
          ? parseFloat(serverEvent.timestamp)
          : serverEvent.timestamp || 0;
      const timeDiff = Math.abs(srvTimestamp - optTimestamp);
      const timeWindow = 2000; // 2 seconds - conservative window for rapid typing

      const optCell = optimisticParams.cell as {r?: number; c?: number} | undefined;
      const srvCell = serverParams.cell as {r?: number; c?: number} | undefined;
      const cellMatch = optCell?.r === srvCell?.r && optCell?.c === srvCell?.c;
      const idMatch = optimisticParams.id === serverParams.id;

      // If cell and user match, and timestamps are close, it's likely the same event
      // (value might have changed if user typed another character)
      if (cellMatch && idMatch && timeDiff < timeWindow) {
        return true;
      }
    }

    return false;
  };

  /**
   * Creates a game event handler that processes incoming websocket events
   */
  const createGameEventHandler = (
    path: string,
    getState: () => GameStore,
    setState: (state: Partial<GameStore>) => void,
    emit: (path: string, event: string, data: unknown) => void
  ) => {
    return (event: unknown) => {
      const processedEvent = castNullsToUndefined(event) as GameEvent;
      const currentState = getState();
      const currentGame = currentState.games[path];

      if (!currentGame) {
        logger.warn('Received event for game that no longer exists', {gamePath: path});
        return;
      }

      // Remove from optimistic events if it was optimistic
      // Try to match by ID first, then by content
      const beforeCount = currentGame.optimisticEvents.length;
      const updatedOptimisticEvents = currentGame.optimisticEvents.filter((ev) => {
        // Keep events that don't match
        const matches = matchesOptimisticEvent(ev, processedEvent);
        if (matches) {
          logger.debug('Matched optimistic event with server event', {
            path,
            optimisticType: ev.type,
            serverType: processedEvent.type,
            optimisticId: ev.id,
            serverId: processedEvent.id,
            optimisticParams: ev.params,
            serverParams: processedEvent.params,
          });
        }
        return !matches;
      });

      // Check for conflicts: if server event is for same resource as optimistic event
      const potentialConflicts: ConflictState[] = [];

      if (beforeCount > 0 && updatedOptimisticEvents.length === beforeCount) {
        // No optimistic events were matched, check for conflicts
        for (const optimisticEvent of currentGame.optimisticEvents) {
          // Check if events are for the same resource (e.g., same cell)
          const isSameResource = checkSameResource(optimisticEvent, processedEvent);

          if (isSameResource && optimisticEvent.type === processedEvent.type) {
            // Conflict detected - same resource, different values
            const conflictId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const baseState = currentGame.gameState; // State before optimistic update

            // Determine conflict type
            const conflictType = determineConflictType(optimisticEvent, processedEvent);
            const description = generateConflictDescription(optimisticEvent, processedEvent);

            potentialConflicts.push({
              id: conflictId,
              optimisticEvent,
              serverEvent: processedEvent,
              baseState,
              conflictType,
              description,
              timestamp: Date.now(),
            });

            logger.warn('Conflict detected between optimistic and server event', {
              path,
              conflictId,
              optimisticType: optimisticEvent.type,
              serverType: processedEvent.type,
              conflictType,
            });
          }
        }

        // Emit conflict events for UI to handle
        potentialConflicts.forEach((conflict) => {
          emit(path, 'conflict', conflict);
        });
      }

      // Log if we removed an optimistic event (for debugging)
      if (updatedOptimisticEvents.length < beforeCount) {
        const removedCount = beforeCount - updatedOptimisticEvents.length;
        logger.info('Removed optimistic event(s) after server confirmation', {
          path,
          removedCount,
          eventType: processedEvent.type,
          remainingOptimistic: updatedOptimisticEvents.length,
        });
      } else if (beforeCount > 0) {
        // Log when we have optimistic events but didn't match any
        logger.debug('Server event did not match any optimistic events', {
          path,
          serverEventType: processedEvent.type,
          serverEventId: processedEvent.id,
          serverParams: processedEvent.params,
          optimisticCount: beforeCount,
          conflictCount: potentialConflicts.length,
          optimisticTypes: currentGame.optimisticEvents.map((e) => e.type),
          optimisticIds: currentGame.optimisticEvents.map((e) => e.id),
        });
      }

      // Add event to events array
      const updatedEvents = [...currentGame.events, processedEvent];

      // Get conflicts from updated state (add new conflicts detected above)
      const existingConflicts = currentGame.conflicts || [];
      const allConflicts = [...existingConflicts, ...potentialConflicts];

      // Compute new game state
      const updatedGame: GameInstance = {
        ...currentGame,
        events: updatedEvents,
        optimisticEvents: updatedOptimisticEvents,
        conflicts: allConflicts,
      };

      if (processedEvent.type === 'create') {
        updatedGame.createEvent = processedEvent;
        const isValid = isValidCreateEvent(processedEvent);
        if (isValid) {
          updatedGame.ready = true;
          logger.info('Received create event via websocket with valid grid, setting ready=true', {
            gamePath: path,
          });
        } else {
          updatedGame.ready = false;
          const params = processedEvent.params as {game?: {grid?: unknown}} | undefined;
          const game = params?.game;
          const grid = game?.grid;
          const gridIsArray = Array.isArray(grid);
          const gridLength = gridIsArray ? grid.length : 0;
          const firstRowLength =
            gridIsArray && grid.length > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;

          logger.error('Received create event via websocket but grid is invalid or empty', {
            gamePath: path,
            hasParams: !!processedEvent.params,
            hasParamsGame: !!game,
            hasGrid: !!grid,
            gridType: typeof grid,
            gridIsArray,
            gridLength,
            firstRowLength,
            gridValue: grid,
            fullEvent: processedEvent,
          });
          logger.warn(
            'Setting ready=false. Game will remain not ready until a valid create event is received',
            {gamePath: path}
          );
        }
      }

      updatedGame.gameState = computeGameState(updatedGame);

      setState({
        games: {
          ...currentState.games,
          [path]: updatedGame,
        },
      });

      if (processedEvent.type === 'create') {
        logger.debug('State updated after create event', {
          gamePath: path,
          ready: getState().games[path]?.ready,
        });
      }

      if (processedEvent.type === 'create') {
        emit(path, 'wsCreateEvent', processedEvent);
      } else {
        emit(path, 'wsEvent', processedEvent);
      }
    };
  };

  // Constants for event archiving
  const RECENT_EVENTS_LIMIT = 1000; // Only load last 1000 events initially
  const _ARCHIVE_THRESHOLD = 1000; // Archive events older than this count (for future use)

  /**
   * Syncs recent game events from the server (last N events)
   * This is the new default method to reduce memory usage
   */
  const syncRecentGameEvents = async (
    path: string,
    limit: number = RECENT_EVENTS_LIMIT
  ): Promise<GameEvent[]> => {
    const gid = path.substring(6);
    logger.info('Syncing recent game events', {gid, limit});

    try {
      // TODO: Update backend to support limit parameter
      // For now, we'll get all events but only store recent ones
      const response = (await socketManager.emitAsync('sync_all_game_events', gid)) as unknown[];

      if (!response || !Array.isArray(response)) {
        logger.error('Invalid response from sync_all_game_events', {gid, response});
        throw new Error(`Invalid response from sync_all_game_events: expected array, got ${typeof response}`);
      }

      const allEvents = response.map((event: unknown) => castNullsToUndefined(event) as GameEvent);

      // Only return recent events (last N)
      const recentEvents = allEvents.slice(-limit);
      logger.info('Received recent events', {
        gid,
        totalCount: allEvents.length,
        recentCount: recentEvents.length,
      });

      // Store total count for reference
      const state = getState();
      const game = state.games[path];
      if (game) {
        setState({
          games: {
            ...state.games,
            [path]: {
              ...game,
              totalEventCount: allEvents.length,
            },
          },
        });
      }

      return recentEvents;
    } catch (error) {
      logger.errorWithException('Error syncing recent game events', error, {path});
      return [];
    }
  };

  /**
   * Syncs all game events from the server (legacy method, kept for backward compatibility)
   * @deprecated Use syncRecentGameEvents instead for better performance
   */
  const _syncAllGameEvents = async (path: string): Promise<GameEvent[]> => {
    return syncRecentGameEvents(path, RECENT_EVENTS_LIMIT);
  };

  /**
   * Loads archived events on demand
   * Backend should support pagination with offset and limit
   */
  const loadArchivedEventsImpl = async (
    path: string,
    offset: number = 0,
    limit: number = 1000
  ): Promise<GameEvent[]> => {
    const gid = path.substring(6);
    logger.info('Loading archived events', {gid, offset, limit});

    try {
      // TODO: Implement backend endpoint: sync_archived_game_events
      // For now, return empty array as placeholder
      // const response = await socketManager.emitAsync('sync_archived_game_events', { gid, offset, limit });

      logger.warn('Archived events loading not yet implemented on backend', {gid});
      return [];
    } catch (error) {
      logger.errorWithException('Error loading archived events', error, {path, offset, limit});
      return [];
    }
  };

  // Alias for export
  const loadArchivedEvents = loadArchivedEventsImpl;

  /**
   * Sorts events by timestamp
   */
  const sortEventsByTimestamp = (events: GameEvent[]): GameEvent[] => {
    return events.sort((a, b) => {
      const aTime = typeof a.timestamp === 'string' ? parseFloat(a.timestamp) : a.timestamp || 0;
      const bTime = typeof b.timestamp === 'string' ? parseFloat(b.timestamp) : b.timestamp || 0;
      return aTime - bTime;
    });
  };

  /**
   * Validates create event and logs detailed info
   */
  const validateCreateEvent = (createEvent: GameEvent | null, path: string): boolean => {
    const hasValidCreateEvent = isValidCreateEvent(createEvent);

    if (createEvent) {
      if (hasValidCreateEvent) {
        logger.info('Found create event with valid grid, marking game as ready', {path});
      } else {
        const params = createEvent.params as {game?: {grid?: unknown}} | undefined;
        const game = params?.game;
        const grid = game?.grid;
        const gridIsArray = Array.isArray(grid);
        const gridLength = gridIsArray ? grid.length : 0;
        const firstRowLength = gridIsArray && grid.length > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;

        logger.error('Found create event but grid is invalid or empty', {
          path,
          hasParams: !!createEvent.params,
          hasParamsGame: !!game,
          hasGrid: !!grid,
          gridType: typeof grid,
          gridIsArray,
          gridLength,
          firstRowLength,
          gridValue: grid,
          fullEvent: createEvent,
        });
        logger.warn('Game will wait for a valid create event via websocket', {path});
      }
    }

    return hasValidCreateEvent;
  };

  const subscribeToWebsocketEvents = async (path: string): Promise<void> => {
    const state = getState();
    const game = state.games[path];
    if (!game) {
      throw new Error('Game not initialized');
    }

    // Ensure socket is connected
    await connectToWebsocket(path);
    const socket = socketManager.getSocket();
    if (!socket || !socket.connected) {
      throw new Error('Not connected to websocket');
    }

    // Create a game-specific event handler using helper function
    const gameEventHandler = createGameEventHandler(path, getState, setState, emit);

    // Register handler directly on socket for immediate use
    socket.on('game_event', gameEventHandler);

    // Also subscribe via socketManager to ensure handler is re-registered on reconnect
    // The handler will be automatically re-registered when socket reconnects
    const unsubscribeGameEvent = socketManager.subscribe('game_event', gameEventHandler);

    // Ensure we re-join the game room and re-register handler after reconnect
    const unsubscribeReconnectHandler = socketManager.subscribe('connect', async () => {
      // Re-join game room on reconnect
      const reconnectGid = path.substring(6);
      await socketManager.emitAsync('join_game', reconnectGid);
    });

    // Sync and sort recent game events (only last 1000)
    const recentEvents = sortEventsByTimestamp(await syncRecentGameEvents(path, RECENT_EVENTS_LIMIT));

    const currentState = getState();
    const currentGame = currentState.games[path];
    if (!currentGame) {
      logger.warn('Game was detached during sync', {path});
      return;
    }

    // Separate create event from other events and validate
    // Note: Create event should always be in recent events (it's the first event)
    const createEvent = recentEvents.find((e) => e.type === 'create') || null;
    const otherEvents = recentEvents.filter((e) => e.type !== 'create');
    const hasValidCreateEvent = validateCreateEvent(createEvent, path);

    // Log if no events or no create event
    if (!createEvent && recentEvents.length > 0) {
      logger.warn(
        'Received events but no create event found. Game will wait for create event via websocket',
        {path}
      );
    } else if (recentEvents.length === 0) {
      logger.warn('No events received from sync. Game will wait for create event via websocket', {path});
    }

    // Update game with recent events
    const updatedGame: GameInstance = {
      ...currentGame,
      createEvent: createEvent || currentGame.createEvent,
      ready: hasValidCreateEvent ? true : false, // Explicitly set to false when invalid
      events: otherEvents,
      totalEventCount: currentGame.totalEventCount || recentEvents.length,
      optimisticEvents: [],
      gameState: computeGameState({
        ...currentGame,
        createEvent: createEvent || currentGame.createEvent,
        events: otherEvents,
        optimisticEvents: [],
      }),
    };

    logger.debug('Setting ready state', {path, ready: updatedGame.ready});
    setState({
      games: {
        ...currentState.games,
        [path]: updatedGame,
      },
    });
    logger.debug('State updated', {path, ready: getState().games[path]?.ready});

    // Emit events to subscribers
    if (createEvent) {
      emit(path, 'wsCreateEvent', createEvent);
    }
    otherEvents.forEach((event) => {
      emit(path, 'wsEvent', event);
    });

    // Store unsubscribe function
    const finalState = getState();
    const finalGame = finalState.games[path];
    if (finalGame) {
      const existingUnsubscribe = finalGame.unsubscribeSocket;
      setState({
        games: {
          ...finalState.games,
          [path]: {
            ...finalGame,
            unsubscribeSocket: () => {
              existingUnsubscribe?.();
              unsubscribeGameEvent();
              unsubscribeReconnectHandler();
              // Also remove direct socket listener
              const currentSocket = socketManager.getSocket();
              if (currentSocket) {
                currentSocket.off('game_event', gameEventHandler);
              }
            },
          },
        },
      });
    }
  };

  const addEvent = async (path: string, event: GameEvent): Promise<void> => {
    event.id = uuid.v4();
    const state = getState();
    const game = state.games[path];
    if (!game || !game.ready) {
      // Game not initialized or not ready yet - skip event
      return;
    }

    // Add to optimistic events and update game state
    const updatedOptimisticEvents = [...game.optimisticEvents, event];
    const updatedGame: GameInstance = {
      ...game,
      optimisticEvents: updatedOptimisticEvents,
    };
    updatedGame.gameState = computeGameState(updatedGame);

    setState({
      games: {
        ...state.games,
        [path]: updatedGame,
      },
    });

    // Emit optimistic event
    emit(path, 'wsOptimisticEvent', event);

    await connectToWebsocket(path);
    await pushEventToWebsocket(path, event);
  };

  /**
   * Cleans up stale optimistic events that haven't been confirmed after a timeout
   * Events older than OPTIMISTIC_EVENT_TIMEOUT_MS are considered stale and removed
   */
  const OPTIMISTIC_EVENT_TIMEOUT_MS = 10000; // 10 seconds
  const cleanupStaleOptimisticEvents = (): void => {
    const state = getState();
    const now = Date.now();
    let hasChanges = false;
    const updatedGames: Record<string, GameInstance> = {};

    for (const [path, game] of Object.entries(state.games)) {
      if (game.optimisticEvents.length === 0) continue;

      const staleEvents = game.optimisticEvents.filter((event) => {
        const eventTime =
          typeof event.timestamp === 'string' ? parseFloat(event.timestamp) : event.timestamp || 0;
        const age = now - eventTime;
        return age > OPTIMISTIC_EVENT_TIMEOUT_MS;
      });

      if (staleEvents.length > 0) {
        const updatedOptimisticEvents = game.optimisticEvents.filter((event) => {
          const eventTime =
            typeof event.timestamp === 'string' ? parseFloat(event.timestamp) : event.timestamp || 0;
          const age = now - eventTime;
          return age <= OPTIMISTIC_EVENT_TIMEOUT_MS;
        });

        logger.warn('Removing stale optimistic events', {
          path,
          removedCount: staleEvents.length,
          eventTypes: staleEvents.map((e) => e.type),
        });

        const updatedGame: GameInstance = {
          ...game,
          optimisticEvents: updatedOptimisticEvents,
        };
        updatedGame.gameState = computeGameState(updatedGame);
        updatedGames[path] = updatedGame;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setState({
        games: {
          ...state.games,
          ...updatedGames,
        },
      });
    }
  };

  // Set up periodic cleanup of stale optimistic events
  const _cleanupInterval = setInterval(() => {
    cleanupStaleOptimisticEvents();
  }, 5000); // Run cleanup every 5 seconds

  // Store cleanup interval ID for potential cleanup on unmount (though Zustand store persists)
  // Note: In a real app, you might want to clear this interval when the store is destroyed

  /**
   * Cleans up stale games based on age and implements LRU eviction when limit is exceeded
   * @param maxAge - Optional max age in milliseconds (defaults to GAME_MAX_AGE_MS)
   */
  const cleanupStaleGames = (maxAge?: number): void => {
    const state = getState();
    const now = Date.now();
    const ageThreshold = maxAge ?? GAME_MAX_AGE_MS;
    const gamesToDetach: string[] = [];

    // First, collect games that are older than the threshold
    for (const [path, game] of Object.entries(state.games)) {
      const age = now - game.lastAccessTime;
      if (age > ageThreshold) {
        gamesToDetach.push(path);
        logger.info('Marking game for cleanup due to age', {
          path,
          ageMinutes: Math.round(age / (60 * 1000)),
          lastAccessTime: new Date(game.lastAccessTime).toISOString(),
        });
      }
    }

    // Detach stale games
    for (const path of gamesToDetach) {
      state.detach(path);
    }

    // Check if we still exceed the limit after removing stale games
    const currentState = getState();
    const currentGameCount = Object.keys(currentState.games).length;
    let lruDetachedCount = 0;

    if (currentGameCount > MAX_GAMES_IN_MEMORY) {
      // Sort games by lastAccessTime (oldest first) for LRU eviction
      const gamesArray = Object.entries(currentState.games).map(([path, game]) => ({
        path,
        lastAccessTime: game.lastAccessTime,
      }));

      gamesArray.sort((a, b) => a.lastAccessTime - b.lastAccessTime);

      // Detach oldest games until we're under the limit
      const excessCount = currentGameCount - MAX_GAMES_IN_MEMORY;
      const lruGamesToDetach = gamesArray.slice(0, excessCount);
      lruDetachedCount = lruGamesToDetach.length;

      logger.info('LRU eviction: detaching games to stay under limit', {
        currentCount: currentGameCount,
        maxAllowed: MAX_GAMES_IN_MEMORY,
        detachingCount: lruDetachedCount,
        games: lruGamesToDetach.map((g) => ({
          path: g.path,
          lastAccessMinutes: Math.round((now - g.lastAccessTime) / (60 * 1000)),
        })),
      });

      for (const {path} of lruGamesToDetach) {
        currentState.detach(path);
      }
    }

    if (gamesToDetach.length > 0 || lruDetachedCount > 0) {
      const finalState = getState();
      logger.debug('Game cleanup completed', {
        gamesRemaining: Object.keys(finalState.games).length,
        detachedCount: gamesToDetach.length + lruDetachedCount,
      });
    }
  };

  /**
   * Gets the current number of games in memory
   */
  const getGameCount = (): number => {
    const state = getState();
    return Object.keys(state.games).length;
  };

  /**
   * Gets subscription statistics for debugging (development only)
   */
  const getSubscriptionStats = (): Record<string, {count: number; events: string[]}> => {
    const state = getState();
    const stats: Record<string, {count: number; events: string[]}> = {};

    for (const [path, game] of Object.entries(state.games)) {
      const eventSet = new Set<string>();
      let totalCount = 0;

      for (const [event, subscribers] of game.subscriptions.entries()) {
        const count = subscribers.size;
        totalCount += count;
        if (count > 0) {
          eventSet.add(event);
        }
      }

      stats[path] = {
        count: totalCount,
        events: Array.from(eventSet),
      };
    }

    return stats;
  };

  // Set up periodic cleanup of stale games
  const _gameCleanupInterval = setInterval(() => {
    cleanupStaleGames();
  }, GAME_CLEANUP_INTERVAL_MS);

  const pushEventToWebsocket = async (path: string, event: GameEvent): Promise<unknown> => {
    const state = getState();
    const game = state.games[path];
    if (!game) {
      throw new Error('Game not initialized');
    }

    // Ensure socket is connected (SocketManager handles connection automatically)
    await connectToWebsocket(path);

    // Get the current socket from socketManager to ensure we're using the connected one
    const socket = socketManager.getSocket();
    if (!socket || !socket.connected) {
      // Wait for connection
      await new Promise<void>((resolve) => {
        const unsubscribe = socketManager.subscribe('connect', () => {
          unsubscribe();
          resolve();
        });
        // If already connected, resolve immediately
        if (socketManager.isConnected()) {
          unsubscribe();
          resolve();
        }
      });
    }

    // Re-join the game room to ensure we're in the right room
    const gid = path.substring(6);
    await socketManager.emitAsync('join_game', gid);

    // Emit the game event
    return socketManager.emitAsync('game_event', {
      event,
      gid,
    });
  };

  return {
    games: {},

    getGame: (path: string) => {
      // Validate path following Firebase best practices
      if (!isValidFirebasePath(path)) {
        logger.error('Invalid game path in getGame', {path});
        throw new Error(`Invalid game path: ${path}`);
      }

      // Validate gid extraction
      const gid = extractAndValidateGid(path);
      if (!gid) {
        logger.error('Invalid gid in game path', {path});
        throw new Error(`Invalid gid in path: ${path}`);
      }

      const state = getState();
      if (!state.games[path]) {
        try {
          const gameRef = ref(db, path);
          const eventsRef = ref(db, `${path}/events`);
          // For backward compatibility - expose game path on window for debugging
          (window as unknown as {game: {path: string}}).game = {path};

          const now = Date.now();
          const newGame: GameInstance = {
            path,
            ref: gameRef,
            eventsRef,
            createEvent: null,
            ready: false,
            events: [],
            totalEventCount: 0,
            gameState: null,
            optimisticEvents: [],
            conflicts: [],
            subscriptions: new Map(),
            lastAccessTime: now,
            createdAt: now,
          };

          setState({
            games: {
              ...state.games,
              [path]: newGame,
            },
          });

          return newGame;
        } catch (error) {
          logger.errorWithException('Error creating game refs', error, {path});
          throw error;
        }
      }
      const game = getState().games[path];
      if (!game) {
        throw new Error(`Failed to get or create game at path: ${path}`);
      }
      // Update access time on every getGame call
      updateAccessTime(path);
      return game;
    },

    attach: async (path: string) => {
      // Validate path following Firebase best practices
      if (!isValidFirebasePath(path)) {
        logger.error('Invalid game path in attach', {path});
        throw new Error(`Invalid game path: ${path}`);
      }

      // Validate gid extraction
      const gid = extractAndValidateGid(path);
      if (!gid) {
        logger.error('Invalid gid in game path', {path});
        throw new Error(`Invalid gid in path: ${path}`);
      }

      const state = getState();
      let game = state.games[path];
      if (!game) {
        try {
          // Create game instance if it doesn't exist
          const gameRef = ref(db, path);
          const eventsRef = ref(db, `${path}/events`);
          const now = Date.now();
          game = {
            path,
            ref: gameRef,
            eventsRef,
            createEvent: null,
            ready: false,
            events: [],
            totalEventCount: 0,
            gameState: null,
            optimisticEvents: [],
            conflicts: [],
            subscriptions: new Map(),
            lastAccessTime: now,
            createdAt: now,
          };
          setState({
            games: {
              ...state.games,
              [path]: game,
            },
          });
        } catch (error) {
          logger.errorWithException('Error creating game instance', error, {path});
          throw error;
        }
      }

      // Subscribe to battleData with error handling (Firebase best practice)
      const battleDataRef = ref(db, `${path}/battleData`);
      const unsubscribeBattleData = onValue(
        battleDataRef,
        (snapshot) => {
          const currentState = getState();
          const currentGame = currentState.games[path];
          if (!currentGame) return; // Game was detached

          emit(path, 'battleData', snapshot.val());
          setState({
            games: {
              ...currentState.games,
              [path]: {
                ...currentGame,
                battleData: snapshot.val(),
              },
            },
          });
        },
        (error) => {
          // Error callback following Firebase best practices
          logger.errorWithException('Error reading battleData', error, {path});
        }
      );

      // Update access time when attaching
      updateAccessTime(path);

      setState({
        games: {
          ...state.games,
          [path]: {
            ...game,
            unsubscribeBattleData,
          },
        },
      });

      await connectToWebsocket(path);
      await subscribeToWebsocketEvents(path);
    },

    detach: (path: string) => {
      const state = getState();
      const game = state.games[path];
      if (!game) return;

      // Clean up subscriptions first
      if (game.unsubscribeBattleData) {
        game.unsubscribeBattleData();
      }
      if (game.eventsRef) {
        off(game.eventsRef);
      }

      // Clean up socket connection if it exists
      if (game.socket) {
        game.socket.off('game_event');
        game.socket.off('connect');
        game.socket.off('disconnect');
        // Don't disconnect the socket here as it might be shared
        // Just remove the event listeners
      }

      // Clean up cache entry for this game
      gameStateCache.delete(path);
      const cacheIndex = cacheAccessOrder.indexOf(path);
      if (cacheIndex !== -1) {
        cacheAccessOrder.splice(cacheIndex, 1);
      }

      // Clean up subscription trackers and warn about orphaned subscriptions
      if (isDevelopment && game.subscriptionTrackers && game.subscriptionTrackers.length > 0) {
        const activeSubscriptions = game.subscriptions;
        let activeCount = 0;
        for (const subscribers of activeSubscriptions.values()) {
          activeCount += subscribers.size;
        }

        if (game.subscriptionTrackers.length > activeCount) {
          logger.warn('Orphaned subscriptions detected on detach', {
            path,
            trackedCount: game.subscriptionTrackers.length,
            activeCount,
            orphanedCount: game.subscriptionTrackers.length - activeCount,
          });
        }
      }

      // Only update state if the game actually exists and will be removed
      // This prevents unnecessary state updates that could trigger re-renders
      if (state.games[path]) {
        const newGames = {...state.games};
        delete newGames[path];
        setState({
          games: newGames,
        });
      }
    },

    subscribe: (path: string, event: string, callback: (data: unknown) => void) => {
      const state = getState();
      const game = state.games[path];
      if (!game) return () => {};

      // Get or create subscription set for this event
      if (!game.subscriptions.has(event)) {
        game.subscriptions.set(event, new Set());
      }
      const subscribers = game.subscriptions.get(event)!;

      // Add callback to subscribers
      subscribers.add(callback);

      // Track subscription in development mode
      if (isDevelopment) {
        if (!game.subscriptionTrackers) {
          game.subscriptionTrackers = [];
        }
        const now = Date.now();
        const tracker: SubscriptionTracker = {
          path,
          event,
          callback,
          createdAt: now,
          lastUsed: now,
        };
        game.subscriptionTrackers.push(tracker);

        // Warn if subscription count is growing unbounded
        const totalSubscriptions = game.subscriptionTrackers.length;
        if (totalSubscriptions > 50) {
          logger.warn('High subscription count detected - potential leak', {
            path,
            subscriptionCount: totalSubscriptions,
            event,
          });
        }

        // Note: We don't call setState here to avoid triggering infinite loops.
        // The subscription trackers are only for debugging/logging purposes,
        // so we can mutate the array directly without causing re-renders.
      }

      // Return unsubscribe function
      return () => {
        const currentState = getState();
        const currentGame = currentState.games[path];
        if (!currentGame) return;

        const currentSubscribers = currentGame.subscriptions.get(event);
        if (currentSubscribers) {
          currentSubscribers.delete(callback);
          // Clean up empty sets
          if (currentSubscribers.size === 0) {
            currentGame.subscriptions.delete(event);
          }
        }

        // Remove tracker in development mode
        if (isDevelopment && currentGame.subscriptionTrackers) {
          const trackerIndex = currentGame.subscriptionTrackers.findIndex(
            (t) => t.path === path && t.event === event && t.callback === callback
          );
          if (trackerIndex !== -1) {
            currentGame.subscriptionTrackers.splice(trackerIndex, 1);
            // Clean up empty array
            if (currentGame.subscriptionTrackers.length === 0) {
              delete currentGame.subscriptionTrackers;
            }
          }
        }
      };
    },

    once: (path: string, event: string, callback: (data: unknown) => void) => {
      const state = getState();
      const game = state.games[path];
      if (!game) return () => {};

      // Wrap callback to auto-unsubscribe after first call
      let called = false;
      const wrappedCallback = (data: unknown) => {
        if (!called) {
          called = true;
          callback(data);
          // Auto-unsubscribe
          const currentState = getState();
          const currentGame = currentState.games[path];
          if (currentGame) {
            const subscribers = currentGame.subscriptions.get(event);
            if (subscribers) {
              subscribers.delete(wrappedCallback);
              if (subscribers.size === 0) {
                currentGame.subscriptions.delete(event);
              }
            }
          }
        }
      };

      // Get or create subscription set for this event
      if (!game.subscriptions.has(event)) {
        game.subscriptions.set(event, new Set());
      }
      const subscribers = game.subscriptions.get(event)!;
      subscribers.add(wrappedCallback);

      // Return unsubscribe function
      return () => {
        const currentState = getState();
        const currentGame = currentState.games[path];
        if (!currentGame) return;

        const currentSubscribers = currentGame.subscriptions.get(event);
        if (currentSubscribers) {
          currentSubscribers.delete(wrappedCallback);
          if (currentSubscribers.size === 0) {
            currentGame.subscriptions.delete(event);
          }
        }
      };
    },

    updateCell: (
      path: string,
      r: number,
      c: number,
      id: string,
      color: string,
      pencil: boolean,
      value: string,
      autocheck: boolean
    ) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: String(SERVER_TIME),
        type: 'updateCell',
        params: {
          cell: {r, c},
          value,
          color,
          pencil,
          id,
          autocheck,
        },
      } as GameEvent);
    },

    updateCursor: (path: string, r: number, c: number, id: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'updateCursor',
        params: {
          timestamp: SERVER_TIME,
          cell: {r, c},
          id,
        },
      } as GameEvent);
    },

    addPing: (path: string, r: number, c: number, id: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'addPing',
        params: {
          timestamp: SERVER_TIME,
          cell: {r, c},
          id,
        },
      });
    },

    updateDisplayName: (path: string, id: string, displayName: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'updateDisplayName',
        params: {
          id,
          displayName,
        },
      });
    },

    updateColor: (path: string, id: string, color: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'updateColor',
        params: {
          id,
          color,
        },
      });
    },

    updateClock: (path: string, action: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'updateClock',
        params: {
          action,
          timestamp: SERVER_TIME,
        },
      } as GameEvent);
    },

    check: (path: string, scope: {r: number; c: number}[]) => {
      if (!scope || scope.length === 0) {
        logger.warn('check called with empty scope', {path});
        return;
      }
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'check',
        params: {
          scope,
        },
      } as unknown as GameEvent);
    },

    reveal: (path: string, scope: {r: number; c: number}[]) => {
      if (!scope || scope.length === 0) {
        logger.warn('reveal called with empty scope', {path});
        return;
      }
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'reveal',
        params: {
          scope,
        },
      } as unknown as GameEvent);
    },

    reset: (path: string, scope: {r: number; c: number}[], force: boolean) => {
      if (!scope || scope.length === 0) {
        logger.warn('reset called with empty scope', {path});
        return;
      }
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'reset',
        params: {
          scope,
          force,
        },
      } as unknown as GameEvent);
    },

    chat: (path: string, username: string, id: string, text: string) => {
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'chat',
        params: {
          username,
          id,
          text,
        },
      });
      addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'sendChatMessage', // send to fencing too
        params: {
          message: text,
          id,
          sender: username,
        },
      } as unknown as GameEvent);
    },

    initialize: async (path: string, rawGame: RawGame, {battleData}: {battleData?: BattleData} = {}) => {
      const {
        info = {},
        grid = [[{}]],
        solution = [['']],
        circles = [],
        chat = {messages: []},
        cursor = {},
        clues = {},
        clock = {
          lastUpdated: 0,
          totalTime: 0,
          paused: true,
        },
        solved = false,
        themeColor = colors.MAIN_BLUE_3,
        pid,
      } = rawGame;

      const game = {
        info,
        grid,
        solution,
        circles,
        chat,
        cursor,
        clues,
        clock,
        solved,
        themeColor,
      };
      const version = CURRENT_VERSION;

      const state = getState();
      const gameInstance = state.games[path] || state.getGame(path);

      await set(ref(db, `${path}/pid`), pid);
      await set(gameInstance.eventsRef, {});
      await addEvent(path, {
        id: '', // Will be set by addEvent
        timestamp: SERVER_TIME,
        type: 'create',
        params: {
          pid,
          version,
          game,
        },
      } as unknown as GameEvent);

      if (battleData) {
        await set(ref(db, `${path}/battleData`), battleData);
      }
    },

    checkArchive: (path: string) => {
      get(ref(db, `${path}/archivedEvents`)).then((snapshot) => {
        const archiveInfo = snapshot.val();
        if (!archiveInfo) {
          return;
        }
        const {unarchivedAt} = archiveInfo;
        if (!unarchivedAt) {
          if (window.confirm('Unarchive game?')) {
            const state = getState();
            state.unarchive(path);
          }
        }
      });
    },

    unarchive: async (path: string) => {
      const snapshot = await get(ref(db, `${path}/archivedEvents`));
      const archiveInfo = snapshot.val();
      if (!archiveInfo) {
        return;
      }
      const {url} = archiveInfo;
      if (url) {
        const events = await (await fetch(url)).json();
        await set(ref(db, `${path}/archivedEvents/unarchivedAt`), SERVER_TIME);
        await set(ref(db, `${path}/events`), events);
      }
    },

    getEvents: (path: string): GameEvent[] => {
      const state = getState();
      const game = state.games[path];
      if (!game) return [];

      // Return recent events + archived events if loaded
      const recentEvents = game.events || [];
      const archivedEvents = game.archivedEvents?.archivedEvents || [];

      // Combine and sort by timestamp
      const allEvents = [...archivedEvents, ...recentEvents];
      return sortEventsByTimestamp(allEvents);
    },

    getCreateEvent: (path: string): GameEvent | null => {
      const state = getState();
      const game = state.games[path];
      return game?.createEvent || null;
    },

    getGameState: (path: string): RawGame | null => {
      const state = getState();
      const game = state.games[path];
      if (!game) return null;

      // Recompute if needed (in case state is stale)
      if (!game.gameState && game.createEvent) {
        return computeGameState(game);
      }

      return game.gameState || null;
    },

    syncRecentGameEvents: async (path: string, limit?: number): Promise<GameEvent[]> => {
      return syncRecentGameEvents(path, limit);
    },
    loadArchivedEvents: async (path: string, offset?: number, limit?: number): Promise<GameEvent[]> => {
      return loadArchivedEvents(path, offset, limit);
    },
    resolveConflict: (path: string, conflictId: string, resolution: 'local' | 'server' | 'merge') => {
      const state = getState();
      const game = state.games[path];
      if (!game) return;

      const conflict = game.conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      // Remove conflict
      const updatedConflicts = game.conflicts.filter((c) => c.id !== conflictId);

      // Apply resolution
      if (resolution === 'local') {
        // Keep optimistic event, remove server event from events
        const updatedEvents = game.events.filter((e) => e.id !== conflict.serverEvent.id);
        // Add optimistic event to events
        const updatedEventsWithLocal = [...updatedEvents, conflict.optimisticEvent];

        setState({
          games: {
            ...state.games,
            [path]: {
              ...game,
              events: updatedEventsWithLocal,
              conflicts: updatedConflicts,
              optimisticEvents: game.optimisticEvents.filter((e) => e.id !== conflict.optimisticEvent.id),
            },
          },
        });
      } else if (resolution === 'server') {
        // Remove optimistic event, keep server event
        const updatedOptimisticEvents = game.optimisticEvents.filter(
          (e) => e.id !== conflict.optimisticEvent.id
        );

        setState({
          games: {
            ...state.games,
            [path]: {
              ...game,
              optimisticEvents: updatedOptimisticEvents,
              conflicts: updatedConflicts,
            },
          },
        });
      } else if (resolution === 'merge') {
        // Merge both changes (simplified - would need more sophisticated merge logic)
        // For now, prefer server event but log merge
        logger.info('Merging conflict', {path, conflictId});
        const updatedOptimisticEvents = game.optimisticEvents.filter(
          (e) => e.id !== conflict.optimisticEvent.id
        );

        setState({
          games: {
            ...state.games,
            [path]: {
              ...game,
              optimisticEvents: updatedOptimisticEvents,
              conflicts: updatedConflicts,
            },
          },
        });
      }

      // Recompute game state
      const updatedGame = getState().games[path];
      if (updatedGame) {
        const newGameState = computeGameState(updatedGame);
        setState({
          games: {
            ...state.games,
            [path]: {
              ...updatedGame,
              gameState: newGameState,
            },
          },
        });
      }
    },
    getConflicts: (path: string): ConflictState[] => {
      const state = getState();
      const game = state.games[path];
      return game?.conflicts || [];
    },
    cleanupStaleGames,
    getGameCount,
    MAX_GAMES_IN_MEMORY,
    GAME_CLEANUP_INTERVAL_MS,
    GAME_MAX_AGE_MS,
    getSubscriptionStats,
  };
});
