import * as colors from '@crosswithfriends/shared/lib/colors';
import {reduce as gameReducer} from '@crosswithfriends/shared/lib/reducers/game';
import {ref, onValue, off, get, set} from 'firebase/database';
import _ from 'lodash';
import {type Socket} from 'socket.io-client';
import * as uuid from 'uuid';
import {create} from 'zustand';

import socketManager from '../sockets/SocketManager';
import type {GameEvent} from '../types/events';
import type {RawGame, BattleData} from '../types/rawGame';

import {db, SERVER_TIME, type DatabaseReference} from './firebase';
import {isValidFirebasePath, extractAndValidateGid} from './firebaseUtils';

// ============ Serialize / Deserialize Helpers ========== //

// Recursively walks obj and converts `null` to `undefined`
const castNullsToUndefined = <T>(obj: T): T => {
  if (_.isNil(obj)) {
    return undefined as T;
  }
  if (typeof obj === 'object') {
    return Object.assign(
      (obj as object).constructor(),
      _.fromPairs(
        _.keys(obj).map((key) => [key, castNullsToUndefined((obj as Record<string, unknown>)[key])])
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
  // Helper function to compute game state from events
  const computeGameState = (game: GameInstance): RawGame | null => {
    if (!game.createEvent) return null;

    // Start with the create event
    let state = gameReducer(null, game.createEvent);

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
          console.error(`Error in subscription callback for ${event}:`, error);
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

    // Create a game-specific event handler that filters by path
    // We need to use a closure to capture the path
    const gameEventHandler = ((gamePath: string) => (event: unknown) => {
      const processedEvent = castNullsToUndefined(event) as GameEvent;
      const currentState = getState();
      const currentGame = currentState.games[gamePath];
      if (!currentGame) {
        console.warn('[gameStore] Received event for game that no longer exists:', gamePath);
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
        updatedGame.ready = true;
        console.warn('[gameStore] Received create event via websocket, setting ready=true for:', gamePath);
      }

      updatedGame.gameState = computeGameState(updatedGame);

      setState({
        games: {
          ...currentState.games,
          [gamePath]: updatedGame,
        },
      });
      if (processedEvent.type === 'create') {
        console.warn(
          '[gameStore] State updated after create event. Current ready state:',
          getState().games[gamePath]?.ready
        );
      }

      if (processedEvent.type === 'create') {
        emit(gamePath, 'wsCreateEvent', processedEvent);
      } else {
        emit(gamePath, 'wsEvent', processedEvent);
      }
    })(path);

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

    // Sync all game events with error handling
    let allEvents: GameEvent[] = [];
    try {
      const gid = path.substring(6);
      console.warn('[gameStore] Syncing all game events for', gid);
      const response = (await socketManager.emitAsync('sync_all_game_events', gid)) as unknown[];

      if (!response || !Array.isArray(response)) {
        console.error('[gameStore] Invalid response from sync_all_game_events:', response);
        throw new Error(`Invalid response from sync_all_game_events: expected array, got ${typeof response}`);
      }

      allEvents = response.map((event: unknown) => castNullsToUndefined(event) as GameEvent);
      console.warn('[gameStore] Received', allEvents.length, 'events from sync_all_game_events');
    } catch (error) {
      console.error('[gameStore] Error syncing game events:', error);
      // Don't throw - allow the game to continue and wait for events via websocket
      // The game will become ready when it receives a create event via websocket
      allEvents = [];
    }

    // Sort events by timestamp
    allEvents.sort((a, b) => {
      const aTime = typeof a.timestamp === 'string' ? parseFloat(a.timestamp) : a.timestamp || 0;
      const bTime = typeof b.timestamp === 'string' ? parseFloat(b.timestamp) : b.timestamp || 0;
      return aTime - bTime;
    });

    const currentState = getState();
    const currentGame = currentState.games[path];
    if (!currentGame) {
      console.warn('[gameStore] Game was detached during sync');
      return;
    }

    // Find create event
    const createEvent = allEvents.find((e) => e.type === 'create') || null;
    const otherEvents = allEvents.filter((e) => e.type !== 'create');

    if (createEvent) {
      console.warn('[gameStore] Found create event, marking game as ready');
    } else if (allEvents.length > 0) {
      console.warn(
        '[gameStore] Received events but no create event found. Game will wait for create event via websocket.'
      );
    } else {
      console.warn(
        '[gameStore] No events received from sync. Game will wait for create event via websocket.'
      );
    }

    // Update game with all events
    const updatedGame: GameInstance = {
      ...currentGame,
      createEvent: createEvent || currentGame.createEvent,
      ready: createEvent ? true : currentGame.ready,
      events: otherEvents,
      optimisticEvents: [],
      gameState: computeGameState({
        ...currentGame,
        createEvent: createEvent || currentGame.createEvent,
        events: otherEvents,
        optimisticEvents: [],
      }),
    };

    console.warn('[gameStore] Setting ready state:', updatedGame.ready, 'for path:', path);
    setState({
      games: {
        ...currentState.games,
        [path]: updatedGame,
      },
    });
    console.warn('[gameStore] State updated. Current ready state:', getState().games[path]?.ready);

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
        console.error('Invalid game path in getGame', path);
        throw new Error(`Invalid game path: ${path}`);
      }

      // Validate gid extraction
      const gid = extractAndValidateGid(path);
      if (!gid) {
        console.error('Invalid gid in game path', path);
        throw new Error(`Invalid gid in path: ${path}`);
      }

      const state = getState();
      if (!state.games[path]) {
        try {
          const gameRef = ref(db, path);
          const eventsRef = ref(db, `${path}/events`);
          (window as any).game = {path}; // For backward compatibility

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
          console.error('Error creating game refs', error);
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
        console.error('Invalid game path in attach', path);
        throw new Error(`Invalid game path: ${path}`);
      }

      // Validate gid extraction
      const gid = extractAndValidateGid(path);
      if (!gid) {
        console.error('Invalid gid in game path', path);
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
          console.error('Error creating game instance', error);
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
          console.error('Error reading battleData', error);
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
        console.warn('check called with empty scope');
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
        console.warn('reveal called with empty scope');
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
        console.warn('reset called with empty scope');
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
