/**
 * Custom hook for game management
 * Provides game state and actions
 */

import {useCallback, useEffect, useRef} from 'react';

import {useGameStore} from '../store/gameStore';
import type {GameEvent} from '../types/events';
import type {RawGame} from '../types/rawGame';
import {logger} from '../utils/logger';

import {useStoreSubscriptions} from './useStoreSubscriptions';

interface UseGameOptions {
  path: string;
  onEvent?: (event: GameEvent) => void;
  onWsEvent?: (event: GameEvent) => void;
  onWsCreateEvent?: (event: GameEvent) => void;
  onWsOptimisticEvent?: (event: GameEvent) => void;
  onReconnect?: () => void;
  onArchived?: () => void;
  onBattleData?: (data: unknown) => void;
}

interface UseGameReturn {
  game: ReturnType<typeof useGameStore.getState>['games'][string] | undefined;
  gameState: RawGame | null; // Computed game state (reactive in Zustand)
  attach: () => Promise<void>;
  detach: () => void;
  updateCell: (
    r: number,
    c: number,
    id: string,
    color: string,
    pencil: boolean,
    value: string,
    autocheck: boolean
  ) => void;
  updateCursor: (r: number, c: number, id: string) => void;
  addPing: (r: number, c: number, id: string) => void;
  updateDisplayName: (id: string, displayName: string) => void;
  updateColor: (id: string, color: string) => void;
  updateClock: (action: string) => void;
  check: (scope: {r: number; c: number}[]) => void;
  reveal: (scope: {r: number; c: number}[]) => void;
  reset: (scope: {r: number; c: number}[], force: boolean) => void;
  chat: (username: string, id: string, text: string) => void;
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  once: (event: string, callback: (data: unknown) => void) => () => void;
  getEvents: () => GameEvent[];
  getCreateEvent: () => GameEvent | null;
  ready: boolean;
}

export function useGame(options: UseGameOptions): UseGameReturn {
  const {
    path,
    onEvent,
    onWsEvent,
    onWsCreateEvent,
    onWsOptimisticEvent,
    onReconnect,
    onArchived,
    onBattleData,
  } = options;
  const gameStore = useGameStore();

  // Use ref to track previous gameState to avoid unnecessary re-renders
  const prevGameStateRef = useRef<RawGame | null>(null);

  // Optimized selector: only return game instance reference (stable)
  // Components should subscribe to specific game properties they need
  const game = useGameStore((state) => state.games[path]);

  // Get gameState reactively with shallow comparison optimization
  // Only re-render if gameState reference actually changes
  const gameState = useGameStore(
    (state) => {
      const gameInstance = state.games[path];
      return gameInstance?.gameState ?? null;
    },
    (a, b) => {
      // Custom equality: only re-render if gameState reference changes
      const aState = a.games[path]?.gameState ?? null;
      const bState = b.games[path]?.gameState ?? null;
      return aState === bState;
    }
  );

  // Get ready state reactively - optimized to only return boolean
  const ready = useGameStore((state) => {
    const gameInstance = state.games[path];
    return gameInstance?.ready ?? false;
  });

  // Ensure game instance exists (lazy initialization) - skip if path is empty
  useEffect(() => {
    if (path && !game) {
      gameStore.getGame(path);
    }
  }, [game, path, gameStore]);

  // Set up event listeners using generic subscription hook - skip if path is empty
  useStoreSubscriptions(gameStore, path || '', {
    event: onEvent,
    wsEvent: onWsEvent,
    wsCreateEvent: onWsCreateEvent,
    wsOptimisticEvent: onWsOptimisticEvent,
    reconnect: onReconnect,
    archived: onArchived,
    battleData: onBattleData,
  });

  const attach = useCallback(async () => {
    if (path) {
      await gameStore.attach(path);
    }
  }, [path, gameStore]);

  // Return methods directly without memoization - they're not passed as dependencies
  return {
    game,
    gameState,
    attach,
    detach: () => {
      if (path) {
        gameStore.detach(path);
      }
    },
    updateCell: (
      r: number,
      c: number,
      id: string,
      color: string,
      pencil: boolean,
      value: string,
      autocheck: boolean
    ) => {
      if (path) {
        gameStore.updateCell(path, r, c, id, color, pencil, value, autocheck);
      }
    },
    updateCursor: (r: number, c: number, id: string) => {
      if (path) {
        gameStore.updateCursor(path, r, c, id);
      }
    },
    addPing: (r: number, c: number, id: string) => {
      if (path) {
        gameStore.addPing(path, r, c, id);
      }
    },
    updateDisplayName: (id: string, displayName: string) => {
      if (path) {
        gameStore.updateDisplayName(path, id, displayName);
      }
    },
    updateColor: (id: string, color: string) => {
      if (path) {
        gameStore.updateColor(path, id, color);
      }
    },
    updateClock: (action: string) => {
      if (path) {
        gameStore.updateClock(path, action);
      }
    },
    check: (scope: {r: number; c: number}[]) => {
      if (path) {
        gameStore.check(path, scope);
      }
    },
    reveal: (scope: {r: number; c: number}[]) => {
      if (path) {
        gameStore.reveal(path, scope);
      }
    },
    reset: (scope: {r: number; c: number}[], force: boolean) => {
      if (path) {
        gameStore.reset(path, scope, force);
      }
    },
    chat: (username: string, id: string, text: string) => {
      if (path) {
        gameStore.chat(path, username, id, text);
      }
    },
    subscribe: (event: string, callback: (data: unknown) => void) => {
      if (path) {
        return gameStore.subscribe(path, event, callback);
      }
      return () => {}; // Return no-op unsubscribe if path is empty
    },
    once: (event: string, callback: (data: unknown) => void) => {
      if (path) {
        return gameStore.once(path, event, callback);
      }
      return () => {}; // Return no-op unsubscribe if path is empty
    },
    getEvents: () => {
      if (path) {
        return gameStore.getEvents(path);
      }
      return [];
    },
    getCreateEvent: () => {
      if (path) {
        return gameStore.getCreateEvent(path);
      }
      return null;
    },
    ready,
  };
}
