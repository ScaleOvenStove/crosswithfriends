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

interface GameInstance {
  path: string;
  ref: DatabaseReference;
  eventsRef: DatabaseReference;
  createEvent: GameEvent | null;
  socket?: Socket;
  battleData?: unknown;
  ready: boolean; // Whether the game has been initialized and is ready
  events: GameEvent[]; // All events for HistoryWrapper compatibility
  gameState: RawGame | null; // Computed game state from events (reactive in Zustand)
  optimisticEvents: GameEvent[]; // Optimistic events that haven't been confirmed
  subscriptions: Map<string, Set<(data: unknown) => void>>; // Map-based subscription system
  unsubscribeBattleData?: () => void;
  unsubscribeSocket?: () => void;
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
  getEvents: (path: string) => GameEvent[]; // Get all events for HistoryWrapper
  getCreateEvent: (path: string) => GameEvent | null; // Get create event
}

export const useGameStore = create<GameStore>((setState, getState) => {
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
  const gameStateCache = new Map<string, GameStateCache>();

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

      // Update cache
      gameStateCache.set(game.path, {
        createEventId,
        eventsLength: currentEventsLength,
        optimisticEventsLength: currentOptimisticLength,
        lastState: state,
      });

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

    // Update cache with new state
    gameStateCache.set(game.path, {
      createEventId,
      eventsLength: currentEventsLength,
      optimisticEventsLength: currentOptimisticLength,
      lastState: state,
    });

    return state;
  };

  // Helper function to emit events to subscribers
  const emit = (path: string, event: string, data: unknown): void => {
    const state = getState();
    const game = state.games[path];
    if (!game) return;

    const subscribers = game.subscriptions.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
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
      const updatedOptimisticEvents = currentGame.optimisticEvents.filter(
        (ev) => ev.id !== processedEvent.id
      );

      // Add event to events array
      const updatedEvents = [...currentGame.events, processedEvent];

      // Compute new game state
      const updatedGame: GameInstance = {
        ...currentGame,
        events: updatedEvents,
        optimisticEvents: updatedOptimisticEvents,
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

  /**
   * Syncs all game events from the server
   */
  const syncAllGameEvents = async (path: string): Promise<GameEvent[]> => {
    const gid = path.substring(6);
    logger.info('Syncing all game events', {gid});

    try {
      const response = (await socketManager.emitAsync('sync_all_game_events', gid)) as unknown[];

      if (!response || !Array.isArray(response)) {
        logger.error('Invalid response from sync_all_game_events', {gid, response});
        throw new Error(`Invalid response from sync_all_game_events: expected array, got ${typeof response}`);
      }

      const allEvents = response.map((event: unknown) => castNullsToUndefined(event) as GameEvent);
      logger.info('Received events from sync_all_game_events', {gid, eventCount: allEvents.length});
      return allEvents;
    } catch (error) {
      logger.errorWithException('Error syncing game events', error, {path});
      return [];
    }
  };

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

    // Sync and sort all game events
    const allEvents = sortEventsByTimestamp(await syncAllGameEvents(path));

    const currentState = getState();
    const currentGame = currentState.games[path];
    if (!currentGame) {
      logger.warn('Game was detached during sync', {path});
      return;
    }

    // Separate create event from other events and validate
    const createEvent = allEvents.find((e) => e.type === 'create') || null;
    const otherEvents = allEvents.filter((e) => e.type !== 'create');
    const hasValidCreateEvent = validateCreateEvent(createEvent, path);

    // Log if no events or no create event
    if (!createEvent && allEvents.length > 0) {
      logger.warn(
        'Received events but no create event found. Game will wait for create event via websocket',
        {path}
      );
    } else if (allEvents.length === 0) {
      logger.warn('No events received from sync. Game will wait for create event via websocket', {path});
    }

    // Update game with all events
    const updatedGame: GameInstance = {
      ...currentGame,
      createEvent: createEvent || currentGame.createEvent,
      ready: hasValidCreateEvent ? true : false, // Explicitly set to false when invalid
      events: otherEvents,
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

          const newGame: GameInstance = {
            path,
            ref: gameRef,
            eventsRef,
            createEvent: null,
            ready: false,
            events: [],
            gameState: null,
            optimisticEvents: [],
            subscriptions: new Map(),
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
          game = {
            path,
            ref: gameRef,
            eventsRef,
            createEvent: null,
            ready: false,
            events: [],
            gameState: null,
            optimisticEvents: [],
            subscriptions: new Map(),
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
      return game?.events || [];
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
  };
});
