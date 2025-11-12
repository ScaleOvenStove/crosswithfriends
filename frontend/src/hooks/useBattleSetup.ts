/**
 * Custom hook for battle setup and initialization
 * Handles battle attachment and state management
 */

import {useEffect} from 'react';
import {useBattle} from './useBattle';
import type {Powerup, Winner, BattlePlayer, Pickup} from '../types/battle';

interface UseBattleSetupOptions {
  bid: number | undefined;
  team: number | undefined;
  onGames?: (games: string[]) => void;
  onPowerups?: (powerups: Record<number, Powerup[]>) => void;
  onStartedAt?: (startedAt: number) => void;
  onPlayers?: (players: Record<string, BattlePlayer>) => void;
  onWinner?: (winner: Winner) => void;
  onPickups?: (pickups: Record<string, Pickup>) => void;
  onUsePowerup?: (powerup: Powerup) => void;
}

interface UseBattleSetupReturn {
  battleHook: ReturnType<typeof useBattle>;
  battle: ReturnType<typeof useBattle>['battle'];
}

export function useBattleSetup({
  bid,
  team,
  onGames,
  onPowerups,
  onStartedAt,
  onPlayers,
  onWinner,
  onPickups,
  onUsePowerup,
}: UseBattleSetupOptions): UseBattleSetupReturn {
  const battlePath = bid ? `/battle/${bid}` : '';

  const battleHook = useBattle({
    path: battlePath || '',
    onGames: (games: string[]) => {
      onGames?.(games);
    },
    onPowerups: (value: unknown) => {
      onPowerups?.(value as Record<number, Powerup[]>);
    },
    onStartedAt: (value: unknown) => {
      onStartedAt?.(value as number);
    },
    onPlayers: (value: unknown) => {
      onPlayers?.(value as Record<string, BattlePlayer>);
    },
    onWinner: (value: unknown) => {
      onWinner?.(value as Winner);
    },
    onPickups: (value: unknown) => {
      onPickups?.(value as Record<string, Pickup>);
    },
    onUsePowerup: (value: unknown) => {
      onUsePowerup?.(value as Powerup);
    },
  });

  // Attach/detach battle when bid changes
  useEffect(() => {
    if (bid && battlePath) {
      battleHook.attach();
      return () => {
        battleHook.detach();
      };
    }
  }, [bid, battlePath, battleHook]);

  return {
    battleHook,
    battle: battleHook.battle,
  };
}

