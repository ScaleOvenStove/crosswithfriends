/**
 * Mock implementations for Zustand stores for Vitest tests
 */
import {vi} from 'vitest';

export const createMockGameStore = () => ({
  games: {},
  getGame: vi.fn((path: string) => ({
    gameState: null,
    ready: false,
  })),
  attach: vi.fn(),
  detach: vi.fn(),
  updateCell: vi.fn(),
  updateCursor: vi.fn(),
  addPing: vi.fn(),
  updateDisplayName: vi.fn(),
  updateColor: vi.fn(),
  updateClock: vi.fn(),
  check: vi.fn(),
  reveal: vi.fn(),
  reset: vi.fn(),
  chat: vi.fn(),
  subscribe: vi.fn(() => () => {}), // Returns unsubscribe function
  once: vi.fn(() => () => {}), // Returns unsubscribe function
  getEvents: vi.fn(() => []),
  getCreateEvent: vi.fn(() => null),
});

export const createMockBattleStore = () => ({
  battles: {},
  getBattle: vi.fn((path: string) => ({
    ready: false,
  })),
  attach: vi.fn(),
  detach: vi.fn(),
  start: vi.fn(),
  setSolved: vi.fn(),
  addPlayer: vi.fn(),
  removePlayer: vi.fn(),
  usePowerup: vi.fn(),
  checkPickups: vi.fn(),
  countLivePickups: vi.fn(),
  spawnPowerups: vi.fn(),
  initialize: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  once: vi.fn(() => () => {}),
});

export const createMockPuzzleStore = () => ({
  puzzles: {},
  getPuzzle: vi.fn(() => ({
    ready: false,
    data: null,
  })),
  attach: vi.fn(),
  detach: vi.fn(),
  waitForReady: vi.fn().mockResolvedValue(undefined),
  toGame: vi.fn(() => null),
  listGames: vi.fn().mockResolvedValue(null),
});

export const createMockUserStore = () => ({
  id: null,
  color: '#000000',
  fb: null,
  attached: false,
  attach: vi.fn(),
  logIn: vi.fn(),
  listUserHistory: vi.fn().mockResolvedValue(null),
  listCompositions: vi.fn().mockResolvedValue(null),
  joinComposition: vi.fn().mockResolvedValue(undefined),
  joinGame: vi.fn().mockResolvedValue(undefined),
  markSolved: vi.fn(),
  recordUsername: vi.fn(),
});
