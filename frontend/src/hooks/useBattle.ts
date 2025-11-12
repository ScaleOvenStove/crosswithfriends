/**
 * Custom hook for battle management
 * Provides battle state, actions, and event subscriptions
 */

import {useEffect} from 'react';
import {useBattleStore} from '../store/battleStore';
import {useStoreSubscriptions} from './useStoreSubscriptions';

interface UseBattleOptions {
  path: string;
  onGames?: (games: string[]) => void;
  onPowerups?: (powerups: unknown) => void;
  onStartedAt?: (startedAt: number) => void;
  onPlayers?: (players: unknown) => void;
  onWinner?: (winner: unknown) => void;
  onPickups?: (pickups: unknown) => void;
  onUsePowerup?: (powerup: unknown) => void;
  onReady?: () => void;
}

interface UseBattleReturn {
  battle: ReturnType<typeof useBattleStore.getState>['battles'][string] | undefined;
  attach: () => void;
  detach: () => void;
  start: () => void;
  setSolved: (team: number) => void;
  addPlayer: (name: string, team: number) => void;
  removePlayer: (name: string, team: number) => void;
  usePowerup: (type: string, team: number) => void;
  checkPickups: (r: number, c: number, game: unknown, team: number) => void;
  countLivePickups: (cbk: (count: number) => void) => void;
  spawnPowerups: (n: number, games: unknown[], cbk?: () => void) => void;
  initialize: (pid: number, bid: number, teams?: number) => void;
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  once: (event: string, callback: (data: unknown) => void) => () => void;
}

export function useBattle(options: UseBattleOptions): UseBattleReturn {
  const {path, onGames, onPowerups, onStartedAt, onPlayers, onWinner, onPickups, onUsePowerup, onReady} = options;
  const battleStore = useBattleStore();
  // Use selector to get reactive updates when battle state changes
  const battle = useBattleStore((state) => state.battles[path]);
  
  // Ensure battle instance exists (lazy initialization) - skip if path is empty
  useEffect(() => {
    if (path && !battle) {
      battleStore.getBattle(path);
    }
  }, [battle, path, battleStore]);

  // Set up event listeners using generic subscription hook - skip if path is empty
  useStoreSubscriptions(battleStore, path || '', {
    games: onGames,
    powerups: onPowerups,
    startedAt: onStartedAt,
    players: onPlayers,
    winner: onWinner,
    pickups: onPickups,
    usePowerup: onUsePowerup,
    ready: onReady,
  });

  // Return methods directly without memoization - they're not passed as dependencies
  return {
    battle,
    attach: () => {
      if (path) {
        battleStore.attach(path);
      }
    },
    detach: () => {
      if (path) {
        battleStore.detach(path);
      }
    },
    start: () => {
      if (path) {
        battleStore.start(path);
      }
    },
    setSolved: (team: number) => {
      if (path) {
        battleStore.setSolved(path, team);
      }
    },
    addPlayer: (name: string, team: number) => {
      if (path) {
        battleStore.addPlayer(path, name, team);
      }
    },
    removePlayer: (name: string, team: number) => {
      if (path) {
        battleStore.removePlayer(path, name, team);
      }
    },
    usePowerup: (type: string, team: number) => {
      if (path) {
        battleStore.usePowerup(path, type, team);
      }
    },
    checkPickups: (r: number, c: number, game: unknown, team: number) => {
      if (path) {
        battleStore.checkPickups(path, r, c, game, team);
      }
    },
    countLivePickups: (cbk: (count: number) => void) => {
      if (path) {
        battleStore.countLivePickups(path, cbk);
      }
    },
    spawnPowerups: (n: number, games: unknown[], cbk?: () => void) => {
      if (path) {
        battleStore.spawnPowerups(path, n, games, cbk);
      }
    },
    initialize: (pid: number, bid: number, teams?: number) => {
      if (path) {
        battleStore.initialize(path, pid, bid, teams);
      }
    },
    subscribe: (event: string, callback: (data: unknown) => void) => {
      if (path) {
        return battleStore.subscribe(path, event, callback);
      }
      return () => {}; // Return no-op unsubscribe if path is empty
    },
    once: (event: string, callback: (data: unknown) => void) => {
      if (path) {
        return battleStore.once(path, event, callback);
      }
      return () => {}; // Return no-op unsubscribe if path is empty
    },
  };
}

