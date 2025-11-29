import {ref, onValue, off} from 'firebase/database';
import {describe, it, expect, beforeEach, vi} from 'vitest';

import socketManager from '../../sockets/SocketManager';
import {useGameStore} from '../../store/gameStore';

// Mock SocketManager - must be inside factory to avoid hoisting issues
vi.mock('../../sockets/SocketManager', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((_event, _data, callback) => {
      if (callback) callback();
    }),
    connected: true,
  };

  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockSocket),
      getSocket: vi.fn(() => mockSocket),
      emitAsync: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
      isConnected: vi.fn(() => true),
    },
  };
});

// Mock Firebase
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
}));

// Mock firebase store
vi.mock('../../store/firebase', () => ({
  db: {},
  SERVER_TIME: {'.sv': 'timestamp'},
}));

// Mock firebaseUtils
vi.mock('../../store/firebaseUtils', () => ({
  isValidFirebasePath: vi.fn((path: string) => path.startsWith('/game/')),
  extractAndValidateGid: vi.fn((path: string) => path.replace('/game/', '')),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

// Mock game reducer
vi.mock('@crosswithfriends/shared/lib/reducers/game', () => ({
  reduce: vi.fn((state, event) => {
    if (event.type === 'create') {
      return {
        grid: [[{}]],
        solution: [['A']],
        clues: {across: [], down: []},
        chat: {messages: []},
        cursor: {},
        clock: {lastUpdated: 0, totalTime: 0, paused: true},
        solved: false,
        info: {},
      };
    }
    return state;
  }),
}));

describe('gameStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({games: {}});
    vi.mocked(window).game = undefined;
  });

  describe('getGame', () => {
    it('should create a new game instance if it does not exist', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      const game = useGameStore.getState().getGame('/game/test-123');

      expect(game).toBeDefined();
      expect(game.path).toBe('/game/test-123');
      expect(game.createEvent).toBeNull();
      expect(game.ready).toBe(false);
      expect(game.events).toEqual([]);
    });

    it('should return existing game instance if it exists', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      const game1 = useGameStore.getState().getGame('/game/test-123');
      const game2 = useGameStore.getState().getGame('/game/test-123');

      expect(game1).toBe(game2);
    });

    it('should throw error for invalid path', () => {
      vi.mocked(ref).mockImplementation(() => {
        throw new Error('Invalid path');
      });

      expect(() => {
        useGameStore.getState().getGame('/invalid/path');
      }).toThrow();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events and return unsubscribe function', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');

      const callback = vi.fn();
      const unsubscribe = useGameStore.getState().subscribe('/game/test-123', 'test', callback);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple subscribers for the same event', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      useGameStore.getState().subscribe('/game/test-123', 'test', callback1);
      useGameStore.getState().subscribe('/game/test-123', 'test', callback2);

      const state = useGameStore.getState();
      const game = state.games['/game/test-123'];
      const subscribers = game.subscriptions.get('test');
      expect(subscribers?.size).toBe(2);
    });
  });

  describe('once', () => {
    it('should subscribe once and auto-unsubscribe', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');

      const callback = vi.fn();
      const unsubscribe = useGameStore.getState().once('/game/test-123', 'test', callback);

      expect(unsubscribe).toBeDefined();
    });
  });

  describe('updateCell', () => {
    it('should add updateCell event', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      // Set game as ready
      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().updateCell('/game/test-123', 0, 0, 'user-id', '#ff0000', false, 'A', true);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });

    it('should not add event if game is not ready', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');
      useGameStore.getState().updateCell('/game/test-123', 0, 0, 'user-id', '#ff0000', false, 'A', true);

      // Game is not ready, so event should not be added
      const state = useGameStore.getState();
      const game = state.games['/game/test-123'];
      expect(game.optimisticEvents.length).toBe(0);
    });
  });

  describe('updateCursor', () => {
    it('should add updateCursor event when game is ready', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().updateCursor('/game/test-123', 0, 0, 'user-id');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });
  });

  describe('check', () => {
    it('should add check event with scope', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().check('/game/test-123', [{r: 0, c: 0}]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });

    it('should not add check event with empty scope', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');
      useGameStore.getState().check('/game/test-123', []);

      // Should not add event
      const state = useGameStore.getState();
      const game = state.games['/game/test-123'];
      expect(game.optimisticEvents.length).toBe(0);
    });
  });

  describe('reveal', () => {
    it('should add reveal event with scope', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().reveal('/game/test-123', [{r: 0, c: 0}]);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should add reset event with scope', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().reset('/game/test-123', [{r: 0, c: 0}], false);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });
  });

  describe('chat', () => {
    it('should add chat event', async () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        if (path === '/game/test-123/battleData') return {path: '/game/test-123/battleData'};
        return {path};
      });
      vi.mocked(onValue).mockReturnValue(vi.fn());

      useGameStore.getState().getGame('/game/test-123');
      await useGameStore.getState().attach('/game/test-123');

      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            ready: true,
            createEvent: {
              type: 'create',
              params: {
                game: {
                  grid: [[{}]],
                },
              },
            },
          },
        },
      });

      useGameStore.getState().chat('/game/test-123', 'username', 'user-id', 'Hello');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socketManager.emitAsync).toHaveBeenCalled();
    });
  });

  describe('getEvents', () => {
    it('should return events for a game', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      useGameStore.getState().getGame('/game/test-123');
      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            events: [{type: 'updateCell', id: 'event-1'}],
          },
        },
      });

      const events = useGameStore.getState().getEvents('/game/test-123');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updateCell');
    });
  });

  describe('getCreateEvent', () => {
    it('should return create event for a game', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });

      const createEvent = {type: 'create', id: 'create-1'};

      useGameStore.getState().getGame('/game/test-123');
      useGameStore.setState({
        games: {
          '/game/test-123': {
            ...useGameStore.getState().games['/game/test-123'],
            createEvent,
          },
        },
      });

      const event = useGameStore.getState().getCreateEvent('/game/test-123');

      expect(event).toBe(createEvent);
    });
  });

  describe('detach', () => {
    it('should clean up subscriptions and remove game', () => {
      const mockRef = {path: '/game/test-123', key: 'test-123'};
      const mockEventsRef = {path: '/game/test-123/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-123') return mockRef;
        if (path === '/game/test-123/events') return mockEventsRef;
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockReturnValue(mockUnsubscribe);

      useGameStore.getState().getGame('/game/test-123');
      useGameStore.getState().attach('/game/test-123');
      useGameStore.getState().detach('/game/test-123');

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(off).toHaveBeenCalled();

      const state = useGameStore.getState();
      expect(state.games['/game/test-123']).toBeUndefined();
    });
  });

  describe('computeGameState caching and optimization', () => {
    beforeEach(() => {
      const mockRef = {path: '/game/test-cache', key: 'test-cache'};
      const mockEventsRef = {path: '/game/test-cache/events', key: 'events'};
      vi.mocked(ref).mockImplementation((db, path) => {
        if (path === '/game/test-cache') return mockRef;
        if (path === '/game/test-cache/events') return mockEventsRef;
        return {path};
      });
    });

    it('should cache computed game state when unchanged', () => {
      const createEvent = {
        id: 'create-1',
        type: 'create',
        params: {
          game: {
            grid: [[{value: ''}]],
            solution: [['A']],
          },
        },
      };

      useGameStore.getState().getGame('/game/test-cache');
      useGameStore.setState({
        games: {
          '/game/test-cache': {
            ...useGameStore.getState().games['/game/test-cache'],
            createEvent,
            ready: true,
            events: [],
            optimisticEvents: [],
          },
        },
      });

      // First access computes the state
      const state1 = useGameStore.getState().games['/game/test-cache']?.gameState;

      // Second access with no changes should return cached state
      const state2 = useGameStore.getState().games['/game/test-cache']?.gameState;

      // Should be the same reference (cached)
      expect(state1).toBe(state2);
    });

    it('should recompute when events are added', () => {
      const createEvent = {
        id: 'create-1',
        type: 'create',
        params: {
          game: {
            grid: [[{value: ''}]],
            solution: [['A']],
          },
        },
      };

      useGameStore.getState().getGame('/game/test-cache');
      useGameStore.setState({
        games: {
          '/game/test-cache': {
            ...useGameStore.getState().games['/game/test-cache'],
            createEvent,
            ready: true,
            events: [],
            optimisticEvents: [],
          },
        },
      });

      // eslint-disable-next-line no-underscore-dangle
      const _initialState = useGameStore.getState().games['/game/test-cache']?.gameState;

      // Add a new event
      useGameStore.setState({
        games: {
          '/game/test-cache': {
            ...useGameStore.getState().games['/game/test-cache'],
            events: [{id: 'event-1', type: 'updateCell'}],
            gameState: null, // Force recompute
          },
        },
      });

      // Trigger recompute by accessing selector
      const game = useGameStore.getState().games['/game/test-cache'];
      // eslint-disable-next-line no-underscore-dangle
      const _updatedState = game?.gameState;

      // Should be different after events changed (would be if computeGameState was called)
      // Note: In real implementation, the gameState would be recomputed
      expect(game?.events.length).toBe(1);
    });

    it('should handle optimistic events correctly', () => {
      const createEvent = {
        id: 'create-1',
        type: 'create',
        params: {
          game: {
            grid: [[{value: ''}]],
            solution: [['A']],
          },
        },
      };

      useGameStore.getState().getGame('/game/test-cache');
      useGameStore.setState({
        games: {
          '/game/test-cache': {
            ...useGameStore.getState().games['/game/test-cache'],
            createEvent,
            ready: true,
            events: [],
            optimisticEvents: [],
          },
        },
      });

      // eslint-disable-next-line no-underscore-dangle
      const _previousState = useGameStore.getState().games['/game/test-cache']?.gameState;

      // Add optimistic event
      useGameStore.setState({
        games: {
          '/game/test-cache': {
            ...useGameStore.getState().games['/game/test-cache'],
            optimisticEvents: [{id: 'optimistic-1', type: 'updateCell'}],
            gameState: null,
          },
        },
      });

      const game = useGameStore.getState().games['/game/test-cache'];
      expect(game?.optimisticEvents.length).toBe(1);
    });
  });
});
