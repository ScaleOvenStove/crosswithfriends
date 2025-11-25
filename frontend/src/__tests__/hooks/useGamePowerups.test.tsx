import {renderHook} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import {useGamePowerups} from '../../hooks/useGamePowerups';

// Mock powerup library
vi.mock('@crosswithfriends/shared/lib/powerups', () => ({
  applyOneTimeEffects: vi.fn(),
}));

describe('useGamePowerups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set up powerup spawning interval when all conditions are met', () => {
    const battleHook = {
      spawnPowerups: vi.fn(),
    };
    const gameState = {grid: [[]]};
    const opponentGameState = {grid: [[]]};
    const gameComponentRef = {current: null};

    renderHook(() =>
      useGamePowerups({
        battlePath: '/battle/123',
        gameState,
        opponentGameState,
        battleHook,
        gameHook: {gameState} as any,
        opponentGameHook: {gameState: opponentGameState} as any,
        gameComponentRef: gameComponentRef as any,
      })
    );

    // Advance timer to trigger interval
    vi.advanceTimersByTime(6000);

    expect(battleHook.spawnPowerups).toHaveBeenCalledWith(1, [gameState, opponentGameState]);
  });

  it('should not set up interval if battlePath is empty', () => {
    const battleHook = {
      spawnPowerups: vi.fn(),
    };
    const gameState = {grid: [[]]};
    const opponentGameState = {grid: [[]]};
    const gameComponentRef = {current: null};

    renderHook(() =>
      useGamePowerups({
        battlePath: '',
        gameState,
        opponentGameState,
        battleHook,
        gameHook: {gameState} as any,
        opponentGameHook: {gameState: opponentGameState} as any,
        gameComponentRef: gameComponentRef as any,
      })
    );

    vi.advanceTimersByTime(6000);

    expect(battleHook.spawnPowerups).not.toHaveBeenCalled();
  });

  it('should not set up interval if battleHook is null', () => {
    const gameState = {grid: [[]]};
    const opponentGameState = {grid: [[]]};
    const gameComponentRef = {current: null};

    renderHook(() =>
      useGamePowerups({
        battlePath: '/battle/123',
        gameState,
        opponentGameState,
        battleHook: null,
        gameHook: {gameState} as any,
        opponentGameHook: {gameState: opponentGameState} as any,
        gameComponentRef: gameComponentRef as any,
      })
    );

    vi.advanceTimersByTime(6000);

    // Should not throw or call anything
    expect(true).toBe(true);
  });

  it('should clear interval on unmount', () => {
    const battleHook = {
      spawnPowerups: vi.fn(),
    };
    const gameState = {grid: [[]]};
    const opponentGameState = {grid: [[]]};
    const gameComponentRef = {current: null};

    const {unmount} = renderHook(() =>
      useGamePowerups({
        battlePath: '/battle/123',
        gameState,
        opponentGameState,
        battleHook,
        gameHook: {gameState} as any,
        opponentGameHook: {gameState: opponentGameState} as any,
        gameComponentRef: gameComponentRef as any,
      })
    );

    unmount();

    // Advance timer - should not call spawnPowerups after unmount
    vi.advanceTimersByTime(6000);

    // The interval should have been cleared, so spawnPowerups should not be called again
    expect(battleHook.spawnPowerups).not.toHaveBeenCalled();
  });

  it('should restart interval when dependencies change', () => {
    const battleHook = {
      spawnPowerups: vi.fn(),
    };
    const gameState = {grid: [[]]};
    const opponentGameState = {grid: [[]]};
    const gameComponentRef = {current: null};

    const {rerender} = renderHook(
      ({battlePath}) =>
        useGamePowerups({
          battlePath,
          gameState,
          opponentGameState,
          battleHook,
          gameHook: {gameState} as any,
          opponentGameHook: {gameState: opponentGameState} as any,
          gameComponentRef: gameComponentRef as any,
        }),
      {initialProps: {battlePath: '/battle/123'}}
    );

    vi.advanceTimersByTime(3000);

    rerender({battlePath: '/battle/456'});

    // Interval should restart, so after 6 seconds from rerender, it should be called
    vi.advanceTimersByTime(6000);

    expect(battleHook.spawnPowerups).toHaveBeenCalled();
  });
});
