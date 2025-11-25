/**
 * Custom hook for battle setup and initialization
 * Handles battle attachment and state management
 */

import {useEffect, useRef} from 'react';

import type {Powerup, Winner, BattlePlayer, Pickup} from '../types/battle';

import {useBattle} from './useBattle';

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
  team: _team,
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

  // Store latest attach/detach in ref to avoid dependency issues
  const attachRef = useRef(battleHook.attach);
  const detachRef = useRef(battleHook.detach);
  useEffect(() => {
    attachRef.current = battleHook.attach;
    detachRef.current = battleHook.detach;
  }, [battleHook.attach, battleHook.detach]);

  // Attach/detach battle when bid changes
  // Use refs to avoid including battleHook in dependencies (which causes infinite loops)
  useEffect(() => {
    if (bid && battlePath) {
      attachRef.current();
      return () => {
        detachRef.current();
      };
    }
    return undefined;
  }, [bid, battlePath]);

  return {
    battleHook,
    battle: battleHook.battle,
  };
}
