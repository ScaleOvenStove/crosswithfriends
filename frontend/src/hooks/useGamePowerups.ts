/**
 * Custom hook for game powerup management
 * Handles powerup spawning intervals and powerup effects
 */

import {useEffect, useRef} from 'react';
import type {Powerup} from '../types/battle';
import * as powerupLib from '@crosswithfriends/shared/lib/powerups';

interface UseGamePowerupsOptions {
  battlePath: string;
  gameState: unknown;
  opponentGameState: unknown;
  battleHook: {
    spawnPowerups: (n: number, games: unknown[], cbk?: () => void) => void;
  } | null;
  gameHook: {
    gameState: unknown;
    updateCell: (r: number, c: number, id: string, color: string, pencil: boolean, value: string, autocheck: boolean) => void;
    updateCursor: (r: number, c: number, id: string) => void;
    addPing: (r: number, c: number, id: string) => void;
    updateColor: (id: string, color: string) => void;
    updateClock: (action: string) => void;
    check: (scope: string) => void;
    reveal: (scope: string) => void;
    reset: (scope: string, force: boolean) => void;
    chat: (username: string, id: string, text: string) => void;
  };
  opponentGameHook: {
    gameState: unknown;
    updateCell: (r: number, c: number, id: string, color: string, pencil: boolean, value: string, autocheck: boolean) => void;
    updateCursor: (r: number, c: number, id: string) => void;
    addPing: (r: number, c: number, id: string) => void;
    updateColor: (id: string, color: string) => void;
    updateClock: (action: string) => void;
    check: (scope: string) => void;
    reveal: (scope: string) => void;
    reset: (scope: string, force: boolean) => void;
    chat: (username: string, id: string, text: string) => void;
  };
  gameComponentRef: React.RefObject<{
    player?: {
      state?: {
        selected?: unknown;
      };
    };
  }>;
  onPowerupUsed?: () => void;
}

export function useGamePowerups({
  battlePath,
  gameState,
  opponentGameState,
  battleHook,
  gameHook,
  opponentGameHook,
  gameComponentRef,
  onPowerupUsed,
}: UseGamePowerupsOptions): void {
  const powerupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up powerup spawning interval when both games are ready
  useEffect(() => {
    if (powerupIntervalRef.current) {
      clearInterval(powerupIntervalRef.current);
      powerupIntervalRef.current = null;
    }

    if (battlePath && gameState && opponentGameState && battleHook) {
      powerupIntervalRef.current = setInterval(() => {
        if (battleHook) {
          battleHook.spawnPowerups(1, [gameState, opponentGameState]);
        }
      }, 6 * 1000);
    }

    return () => {
      if (powerupIntervalRef.current) {
        clearInterval(powerupIntervalRef.current);
        powerupIntervalRef.current = null;
      }
    };
  }, [battlePath, gameState, opponentGameState, battleHook]);

  // Handle powerup usage
  const handleUsePowerup = (powerup: Powerup) => {
    if (gameComponentRef.current?.player) {
      const selected = gameComponentRef.current.player.state?.selected;
      try {
        powerupLib.applyOneTimeEffects(powerup, {
          gameModel: gameHook as unknown,
          opponentGameModel: opponentGameHook as unknown,
          selected,
        });
        onPowerupUsed?.();
      } catch (error) {
        console.error('Error applying powerup effects', error);
      }
    }
  };

  // This hook doesn't return anything - it just manages side effects
  // The powerup usage handler would need to be exposed differently if needed
}

