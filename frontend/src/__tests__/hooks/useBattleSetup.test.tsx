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
  useBattle: (options: {
    path: string;
    onGames?: (games: string[]) => void;
    onPowerups?: (powerups: unknown) => void;
    onStartedAt?: (startedAt: number) => void;
    onPlayers?: (players: unknown) => void;
    onWinner?: (winner: unknown) => void;
    onPickups?: (pickups: unknown) => void;
    onUsePowerup?: (powerup: unknown) => void;
  }) => {
    // Store callbacks for test access
    (mockBattleHook as any).callbacks = {
      onGames: options.onGames,
      onPowerups: options.onPowerups,
      onStartedAt: options.onStartedAt,
      onPlayers: options.onPlayers,
      onWinner: options.onWinner,
      onPickups: options.onPickups,
      onUsePowerup: options.onUsePowerup,
    };
    return mockBattleHook;
  },
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

    renderHook(() => useBattleSetup({bid: 123, team: 0, onGames}));

    // Simulate games event by calling the stored callback
    await waitFor(() => {
      expect((mockBattleHook as any).callbacks?.onGames).toBeDefined();
    });

    // Trigger the callback
    (mockBattleHook as any).callbacks.onGames(games);

    // Wait for the callback to be called
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

    renderHook(() => useBattleSetup({bid: 123, team: 0, onPowerups}));

    // Simulate powerups event by calling the stored callback
    await waitFor(() => {
      expect((mockBattleHook as any).callbacks?.onPowerups).toBeDefined();
    });

    // Trigger the callback
    (mockBattleHook as any).callbacks.onPowerups(powerups);

    // Wait for the callback to be called
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
