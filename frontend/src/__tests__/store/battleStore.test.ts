import {ref, onValue, get, set, push, remove, runTransaction} from 'firebase/database';
import {describe, it, expect, beforeEach, vi} from 'vitest';

import {useBattleStore} from '../../store/battleStore';
import {usePuzzleStore} from '../../store/puzzleStore';

// Mock Firebase
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  push: vi.fn(),
  remove: vi.fn(),
  runTransaction: vi.fn(),
}));

// Mock firebase store
vi.mock('../../store/firebase', () => ({
  db: {},
  SERVER_TIME: {'.sv': 'timestamp'},
}));

// Mock puzzleStore
vi.mock('../../store/puzzleStore', () => {
  const mockPuzzleStoreState = {
    getPuzzle: vi.fn(),
    attach: vi.fn(),
    waitForReady: vi.fn().mockResolvedValue(undefined),
    toGame: vi.fn(() => ({
      grid: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      solution: [
        ['A', 'B'],
        ['C', 'D'],
      ],
    })),
    detach: vi.fn(),
    puzzles: {},
  };
  return {
    usePuzzleStore: {
      getState: () => mockPuzzleStoreState,
    },
  };
});

// Mock actions
vi.mock('../../actions', () => ({
  default: {
    reveal: vi.fn(),
    check: vi.fn(),
    reset: vi.fn(),
    createGameForBattle: vi.fn((_arg, callback) => {
      if (callback) callback('game-1');
    }),
  },
}));

describe('battleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBattleStore.setState({battles: {}});
  });

  describe('getBattle', () => {
    it('should create a new battle instance if it does not exist', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRef);

      const battle = useBattleStore.getState().getBattle('/battle/123');

      expect(battle).toBeDefined();
      if (!battle) {
        throw new Error('Battle not found');
      }
      expect(battle.path).toBe('/battle/123');
      expect(battle.subscriptions).toBeDefined();
    });

    it('should return existing battle instance if it exists', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRef);

      const battle1 = useBattleStore.getState().getBattle('/battle/123');
      const battle2 = useBattleStore.getState().getBattle('/battle/123');

      expect(battle1).toBe(battle2);
    });
  });

  describe('attach', () => {
    it('should subscribe to battle data', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123') return mockRef;
        if (path === '/battle/123/games') return {path: '/battle/123/games'};
        if (path === '/battle/123/powerups') return {path: '/battle/123/powerups'};
        if (path === '/battle/123/startedAt') return {path: '/battle/123/startedAt'};
        if (path === '/battle/123/players') return {path: '/battle/123/players'};
        if (path === '/battle/123/winner') return {path: '/battle/123/winner'};
        if (path === '/battle/123/pickups') return {path: '/battle/123/pickups'};
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockReturnValue(mockUnsubscribe);

      const battle = useBattleStore.getState().getBattle('/battle/123');
      if (!battle) {
        throw new Error('Battle not found');
      }
      useBattleStore.getState().attach('/battle/123');

      expect(onValue).toHaveBeenCalled();
    });

    it('should create battle instance if it does not exist when attaching', () => {
      const mockRef = {path: '/battle/nonexistent', key: 'nonexistent'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/nonexistent') return mockRef;
        if (path.startsWith('/battle/nonexistent/')) return {path};
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockReturnValue(mockUnsubscribe);

      useBattleStore.getState().attach('/battle/nonexistent');

      // Battle store creates instance if it doesn't exist, so onValue will be called
      expect(onValue).toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('should unsubscribe from battle data', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123') return mockRef;
        if (path.startsWith('/battle/123/')) return {path};
        return {path};
      });
      const mockUnsubscribe = vi.fn();
      vi.mocked(onValue).mockReturnValue(mockUnsubscribe);

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().attach('/battle/123');
      useBattleStore.getState().detach('/battle/123');

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events and return unsubscribe function', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRef);

      useBattleStore.getState().getBattle('/battle/123');

      const callback = vi.fn();
      const unsubscribe = useBattleStore.getState().subscribe('/battle/123', 'test', callback);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple subscribers for the same event', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRef);

      useBattleStore.getState().getBattle('/battle/123');

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      useBattleStore.getState().subscribe('/battle/123', 'test', callback1);
      useBattleStore.getState().subscribe('/battle/123', 'test', callback2);

      const state = useBattleStore.getState();
      const battle = state.battles['/battle/123'];
      if (!battle) {
        throw new Error('Battle not found');
      }
      const subscribers = battle.subscriptions.get('test');
      expect(subscribers?.size).toBe(2);
    });
  });

  describe('once', () => {
    it('should subscribe once and auto-unsubscribe', () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockReturnValue(mockRef);

      useBattleStore.getState().getBattle('/battle/123');

      const callback = vi.fn();
      const unsubscribe = useBattleStore.getState().once('/battle/123', 'test', callback);

      expect(unsubscribe).toBeDefined();
    });
  });

  describe('start', () => {
    it('should set startedAt timestamp', () => {
      const mockRef = {path: '/battle/123/startedAt', key: 'startedAt'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(set).mockResolvedValue(undefined);

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().start('/battle/123');

      expect(set).toHaveBeenCalled();
    });
  });

  describe('setSolved', () => {
    it('should set winner using transaction', () => {
      const mockRef = {path: '/battle/123/winner', key: 'winner'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(runTransaction).mockImplementation(
        (_ref: unknown, callback: (current: unknown) => unknown) => {
          callback(null);
          return Promise.resolve({});
        }
      );

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().setSolved('/battle/123', 0);

      expect(runTransaction).toHaveBeenCalled();
    });

    it('should not overwrite existing winner', () => {
      const mockRef = {path: '/battle/123/winner', key: 'winner'};
      vi.mocked(ref).mockReturnValue(mockRef);
      let transactionCallback: ((current: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation(
        (_ref: unknown, callback: (current: unknown) => unknown) => {
          transactionCallback = callback;
          return Promise.resolve({});
        }
      );

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().setSolved('/battle/123', 0);

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        // If winner already exists, should return it unchanged
        const existingWinner = {team: 1, completedAt: 1000};
        const result = transactionCallback(existingWinner);
        expect(result).toBe(existingWinner);
      }
    });

    it('should set winner with team and completedAt when no winner exists', () => {
      const mockRef = {path: '/battle/123/winner', key: 'winner'};
      vi.mocked(ref).mockReturnValue(mockRef);
      let transactionCallback: ((current: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation(
        (_ref: unknown, callback: (current: unknown) => unknown) => {
          transactionCallback = callback;
          return Promise.resolve({});
        }
      );

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().setSolved('/battle/123', 0);

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        // If no winner exists, should set new winner
        const result = transactionCallback(null) as {team: number; completedAt: number};
        expect(result.team).toBe(0);
        expect(result.completedAt).toBeGreaterThan(0);
        expect(typeof result.completedAt).toBe('number');
      }
    });
  });

  describe('addPlayer', () => {
    it('should add player to battle', () => {
      const mockRef = {path: '/battle/123/players', key: 'players'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(push).mockReturnValue({key: 'player-1'});

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().addPlayer('/battle/123', 'Player 1', 0);

      expect(push).toHaveBeenCalled();
    });
  });

  describe('removePlayer', () => {
    it('should remove player from battle', async () => {
      const mockRef = {path: '/battle/123/players', key: 'players'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/players') return mockRef;
        if (path === '/battle/123/players/player-1') return {path: '/battle/123/players/player-1'};
        return {path};
      });
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          'player-1': {name: 'Player 1', team: 0},
        }),
      });
      vi.mocked(remove).mockResolvedValue(undefined);

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().removePlayer('/battle/123', 'Player 1', 0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(get).toHaveBeenCalled();
    });

    it('should handle null players gracefully', async () => {
      const mockRef = {path: '/battle/123/players', key: 'players'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(get).mockResolvedValue({
        val: () => null,
      });

      useBattleStore.getState().getBattle('/battle/123');
      await useBattleStore.getState().removePlayer('/battle/123', 'Player 1', 0);

      expect(remove).not.toHaveBeenCalled();
    });

    it('should find and remove correct player by name and team', async () => {
      const mockRef = {path: '/battle/123/players', key: 'players'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/players') return mockRef;
        if (path === '/battle/123/players/player-2') return {path: '/battle/123/players/player-2'};
        return {path};
      });
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          'player-1': {name: 'Player 1', team: 0},
          'player-2': {name: 'Player 2', team: 1},
          'player-3': {name: 'Player 1', team: 1}, // Same name, different team
        }),
      });
      vi.mocked(remove).mockResolvedValue(undefined);

      useBattleStore.getState().getBattle('/battle/123');
      await useBattleStore.getState().removePlayer('/battle/123', 'Player 2', 1);

      expect(remove).toHaveBeenCalledWith({path: '/battle/123/players/player-2'});
    });

    it('should not remove player if name and team do not match', async () => {
      const mockRef = {path: '/battle/123/players', key: 'players'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          'player-1': {name: 'Player 1', team: 0},
        }),
      });

      useBattleStore.getState().getBattle('/battle/123');
      await useBattleStore.getState().removePlayer('/battle/123', 'Player 2', 0);

      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('usePowerup', () => {
    it('should use powerup for team', async () => {
      const mockRef = {path: '/battle/123/powerups', key: 'powerups'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          0: [{type: 'reveal', used: false}],
          1: [],
        }),
      });
      vi.mocked(set).mockResolvedValue(undefined);

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore.getState().usePowerup('/battle/123', 'reveal', 0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(get).toHaveBeenCalled();
    });
  });

  describe('checkPickups', () => {
    it('should check for pickups at cell location', async () => {
      const mockRef = {path: '/battle/123/pickups', key: 'pickups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockRef;
        if (path === '/battle/123/powerups') return {path: '/battle/123/powerups'};
        return {path};
      });
      vi.mocked(get).mockResolvedValue({
        val: () => ({}),
      });
      vi.mocked(set).mockResolvedValue(undefined);

      const mockGame = {
        grid: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        solution: [
          ['A', 'B'],
          ['C', 'D'],
        ],
      };

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .checkPickups('/battle/123', 0, 0, mockGame as {grid: unknown[][]; solution: string[][]}, 0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(get).toHaveBeenCalled();
    });

    it('should mark pickups as pickedUp when cell is correct', async () => {
      const mockPickupsRef = {path: '/battle/123/pickups', key: 'pickups'};
      const mockPowerupsRef = {path: '/battle/123/powerups', key: 'powerups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockPickupsRef;
        if (path === '/battle/123/powerups') return mockPowerupsRef;
        return {path};
      });

      const mockPickups = {
        'pickup-1': {i: 0, j: 0, type: 'reveal', pickedUp: false},
        'pickup-2': {i: 1, j: 1, type: 'check', pickedUp: false},
      };

      vi.mocked(get).mockImplementation((ref) => {
        if (ref === mockPickupsRef) {
          return Promise.resolve({val: () => mockPickups});
        }
        return Promise.resolve({val: () => ({})});
      });

      let pickupTransactionCallback: ((current: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation((ref, callback) => {
        if (ref === mockPickupsRef) {
          pickupTransactionCallback = callback;
        }
        return Promise.resolve({});
      });

      const mockGame = {
        grid: [[{value: 'A'}], [{value: ''}]],
        solution: [['A'], ['B']],
      };

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .checkPickups('/battle/123', 0, 0, mockGame as {grid: unknown[][]; solution: string[][]}, 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(pickupTransactionCallback).toBeDefined();
      if (pickupTransactionCallback) {
        const result = pickupTransactionCallback(mockPickups) as Record<string, {pickedUp: boolean}>;
        expect(result['pickup-1'].pickedUp).toBe(true);
      }
    });

    it('should add powerups to team when pickup is collected', async () => {
      const mockPickupsRef = {path: '/battle/123/pickups', key: 'pickups'};
      const mockPowerupsRef = {path: '/battle/123/powerups', key: 'powerups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockPickupsRef;
        if (path === '/battle/123/powerups') return mockPowerupsRef;
        return {path};
      });

      const mockPickups = {
        'pickup-1': {i: 0, j: 0, type: 'reveal', pickedUp: false},
      };

      vi.mocked(get).mockImplementation((ref) => {
        if (ref === mockPickupsRef) {
          return Promise.resolve({val: () => mockPickups});
        }
        return Promise.resolve({val: () => ({})});
      });

      let powerupTransactionCallback: ((current: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation((ref, callback) => {
        if (ref === mockPowerupsRef) {
          powerupTransactionCallback = callback;
        }
        return Promise.resolve({});
      });

      const mockGame = {
        grid: [[{value: 'A'}]],
        solution: [['A']],
      };

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .checkPickups('/battle/123', 0, 0, mockGame as {grid: unknown[][]; solution: string[][]}, 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(powerupTransactionCallback).toBeDefined();
      if (powerupTransactionCallback) {
        const result = powerupTransactionCallback({}) as Record<number, Array<{type: string}>>;
        expect(result[0]).toBeDefined();
        expect(result[0].some((p) => p.type === 'reveal')).toBe(true);
      }
    });

    it('should not mark pickup if cell value does not match solution', async () => {
      const mockPickupsRef = {path: '/battle/123/pickups', key: 'pickups'};
      const mockPowerupsRef = {path: '/battle/123/powerups', key: 'powerups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockPickupsRef;
        if (path === '/battle/123/powerups') return mockPowerupsRef;
        return {path};
      });

      const mockPickups = {
        'pickup-1': {i: 0, j: 0, type: 'reveal', pickedUp: false},
      };

      vi.mocked(get).mockResolvedValue({
        val: () => mockPickups,
      });

      const mockGame = {
        grid: [[{value: 'B'}]], // Wrong value
        solution: [['A']],
      };

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .checkPickups('/battle/123', 0, 0, mockGame as {grid: unknown[][]; solution: string[][]}, 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not call transaction if no pickups match
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('should not process already picked up items', async () => {
      const mockPickupsRef = {path: '/battle/123/pickups', key: 'pickups'};
      const mockPowerupsRef = {path: '/battle/123/powerups', key: 'powerups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockPickupsRef;
        if (path === '/battle/123/powerups') return mockPowerupsRef;
        return {path};
      });

      const mockPickups = {
        'pickup-1': {i: 0, j: 0, type: 'reveal', pickedUp: true}, // Already picked up
      };

      vi.mocked(get).mockResolvedValue({
        val: () => mockPickups,
      });

      const mockGame = {
        grid: [[{value: 'A'}]],
        solution: [['A']],
      };

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .checkPickups('/battle/123', 0, 0, mockGame as {grid: unknown[][]; solution: string[][]}, 0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should not process already picked up items
      expect(runTransaction).not.toHaveBeenCalled();
    });
  });

  describe('countLivePickups', () => {
    it('should count live pickups', async () => {
      const mockRef = {path: '/battle/123/pickups', key: 'pickups'};
      vi.mocked(ref).mockReturnValue(mockRef);
      vi.mocked(get).mockResolvedValue({
        val: () => ({
          'pickup-1': {pickedUp: false},
          'pickup-2': {pickedUp: true},
          'pickup-3': {pickedUp: false},
        }),
      });

      useBattleStore.getState().getBattle('/battle/123');

      const callback = vi.fn();
      useBattleStore.getState().countLivePickups('/battle/123', callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(2);
    });
  });

  describe('spawnPowerups', () => {
    it('should spawn powerups', async () => {
      const mockRef = {path: '/battle/123/pickups', key: 'pickups'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123/pickups') return mockRef;
        return {path};
      });
      vi.mocked(get).mockResolvedValue({
        val: () => ({}), // No existing pickups
      });
      vi.mocked(push).mockResolvedValue({key: 'pickup-1'});

      const mockGames = [
        {
          grid: [
            ['A', 'B'],
            ['C', 'D'],
          ],
          solution: [
            ['A', 'B'],
            ['C', 'D'],
          ],
        },
      ];

      useBattleStore.getState().getBattle('/battle/123');
      useBattleStore
        .getState()
        .spawnPowerups('/battle/123', 5, mockGames as {grid: unknown[][]; solution: string[][]}[]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(get).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize battle', async () => {
      const mockRef = {path: '/battle/123', key: '123'};
      vi.mocked(ref).mockImplementation((_db: unknown, path: string) => {
        if (path === '/battle/123') return mockRef;
        if (path === '/battle/123/gids') return {path: '/battle/123/gids'};
        if (path === '/battle/123/powerups') return {path: '/battle/123/powerups'};
        if (path === '/puzzle/123') return {path: '/puzzle/123'};
        return {path};
      });
      vi.mocked(set).mockResolvedValue(undefined);
      vi.mocked(get).mockResolvedValue({
        val: () => null,
      });

      // Reset mocks
      vi.clearAllMocks();
      const puzzleStore = usePuzzleStore.getState();
      vi.mocked(puzzleStore.waitForReady).mockResolvedValue(undefined);

      useBattleStore.getState().getBattle('/battle/123');

      // Initialize is async and complex - just verify it doesn't throw
      expect(() => {
        useBattleStore.getState().initialize('/battle/123', 123, 456, 2);
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify puzzleStore methods were called
      expect(puzzleStore.getPuzzle).toHaveBeenCalled();
    });
  });
});
