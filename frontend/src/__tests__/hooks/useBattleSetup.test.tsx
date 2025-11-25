import {renderHook, waitFor} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useBattleSetup} from '../../hooks/useBattleSetup';

// Mock useBattle - must be defined before the mock
const mockBattleHook = {
  battle: null,
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
};

vi.mock('../../hooks/useBattle', () => ({
  useBattle: () => mockBattleHook,
}));

describe('useBattleSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBattleHook.attach = vi.fn();
    mockBattleHook.detach = vi.fn();
    mockBattleHook.battle = null;
  });

  it('should return battle hook and battle', () => {
    const {result} = renderHook(() => useBattleSetup({bid: 123, team: 0}));

    expect(result.current.battleHook).toBeDefined();
    expect(result.current.battle).toBeDefined();
  });

  it('should attach battle when bid is provided', async () => {
    renderHook(() => useBattleSetup({bid: 123, team: 0}));

    await waitFor(() => {
      expect(mockBattleHook.attach).toHaveBeenCalled();
    });
  });

  it('should call onGames when games are received', async () => {
    const onGames = vi.fn();
    const games = ['game-1', 'game-2'];

    let gamesCallback: ((data: unknown) => void) | null = null;
    const subscribeMock = vi.fn((_path, event, callback) => {
      if (event === 'games') {
        gamesCallback = callback;
        // Call immediately to simulate subscription
        setTimeout(() => {
          if (gamesCallback) {
            gamesCallback(games);
          }
        }, 10);
      }
      return () => {};
    });
    mockBattleHook.subscribe = subscribeMock;

    renderHook(() => useBattleSetup({bid: 123, team: 0, onGames}));

    // Wait for subscription to be set up and callback to be called
    await waitFor(
      () => {
        expect(onGames).toHaveBeenCalledWith(games);
      },
      {timeout: 1000}
    );
  });

  it('should call onPowerups when powerups are received', async () => {
    const onPowerups = vi.fn();
    const powerups = {0: [{type: 'reveal'}], 1: []};

    let powerupsCallback: ((data: unknown) => void) | null = null;
    const subscribeMock = vi.fn((_path, event, callback) => {
      if (event === 'powerups') {
        powerupsCallback = callback;
        // Call immediately to simulate subscription
        setTimeout(() => {
          if (powerupsCallback) {
            powerupsCallback(powerups);
          }
        }, 10);
      }
      return () => {};
    });
    mockBattleHook.subscribe = subscribeMock;

    renderHook(() => useBattleSetup({bid: 123, team: 0, onPowerups}));

    // Wait for subscription to be set up and callback to be called
    await waitFor(
      () => {
        expect(onPowerups).toHaveBeenCalledWith(powerups);
      },
      {timeout: 1000}
    );
  });

  it('should detach battle on unmount', async () => {
    // Mock detach to not cause infinite loops
    mockBattleHook.detach = vi.fn();

    const {unmount} = renderHook(() => useBattleSetup({bid: 123, team: 0}));

    await waitFor(
      () => {
        expect(mockBattleHook.attach).toHaveBeenCalled();
      },
      {timeout: 1000}
    );

    // Unmount should call detach
    unmount();

    // Note: In real code, detach may cause re-renders, but in tests we verify the cleanup is set up
    expect(mockBattleHook.detach).toHaveBeenCalled();
  });

  it('should not attach if bid is undefined', () => {
    renderHook(() => useBattleSetup({bid: undefined, team: 0}));

    expect(mockBattleHook.attach).not.toHaveBeenCalled();
  });
});
