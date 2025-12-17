/**
 * Game hook - Composition hook that combines all game-related functionality
 * Implements REQ-1: Core Gameplay Features
 *
 * This hook composes:
 * - useGameData: Data fetching
 * - useGameSocket: Socket management
 * - useGameClock: Clock management
 * - useGameEventSync: Event synchronization
 * - useGameUI: UI state management
 */

import { useCallback, useEffect } from 'react';
import { useGameStore } from '@stores/gameStore';
import { useSocketEvent } from '@sockets/index';
import { useUser } from '@hooks/user/useUser';
import { useGameData } from './useGameData';
import { useGameSocket } from './useGameSocket';
import { useGameClock } from './useGameClock';
import { useGameEventSync } from './useGameEventSync';
import { useGameUI } from './useGameUI';
import { optimisticUpdateQueue } from '@services/optimisticUpdateQueue';
import { safeValidateGameEvent, type GameEvent } from '@schemas/gameEventSchemas';

export const useGame = (gameId: string | undefined) => {
  // Compose all focused hooks
  const gameData = useGameData(gameId);
  const gameSocket = useGameSocket(gameId);
  const gameClock = useGameClock();
  const gameUI = useGameUI();

  // Get additional store state using selectors
  const cells = useGameStore((state) => state.cells);
  const users = useGameStore((state) => state.users);
  const isComplete = useGameStore((state) => state.isComplete);
  const { updateCell, addUser, removeUser, updateCursor, setComplete, pauseClock } = useGameStore();

  const { user } = useUser();

  // Event sync hook
  const eventSync = useGameEventSync({
    gameId,
    isConnected: gameSocket.isConnected,
    hasLoadedPuzzle: gameData.hasLoaded,
    socket: gameSocket.socket,
  });

  // Join game when connected and puzzle is loaded
  useEffect(() => {
    if (
      gameSocket.isConnected &&
      gameId &&
      user &&
      gameData.hasLoaded &&
      gameSocket.socket &&
      !eventSync.hasSyncedEvents
    ) {
      gameSocket.joinGame(gameId);
    }
  }, [
    gameSocket.isConnected,
    gameId,
    user,
    gameData.hasLoaded,
    gameSocket.socket,
    eventSync.hasSyncedEvents,
    gameSocket.joinGame,
  ]);

  // Socket event handlers using proper event validation
  useSocketEvent('userJoined', (data: unknown) => {
    if (data && typeof data === 'object' && 'user' in data) {
      const userData = (data as { user: unknown }).user;
      if (userData && typeof userData === 'object' && 'id' in userData) {
        addUser(userData as Parameters<typeof addUser>[0]);
      }
    }
  });

  useSocketEvent('userLeft', (data: unknown) => {
    if (data && typeof data === 'object' && 'userId' in data) {
      const userId = (data as { userId: unknown }).userId;
      if (typeof userId === 'string') {
        removeUser(userId);
      }
    }
  });

  // Listen for real-time game events
  useSocketEvent('game_event', (event: unknown) => {
    const validation = safeValidateGameEvent(event);
    if (!validation.success) {
      console.warn('[useGame] Invalid game_event received:', validation.error);
      return;
    }

    const gameEvent = validation.data!;

    // Only process events from other users
    if (gameEvent.user === user?.id) {
      return;
    }

    if (gameEvent.type === 'updateCell' && gameEvent.params) {
      const { cell, value } = gameEvent.params as {
        cell?: { r?: number; c?: number };
        value?: string;
      };
      if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
        updateCell(cell.r, cell.c, value || '', false);
      }
    } else if (gameEvent.type === 'updateCursor' && gameEvent.params) {
      const { cell, id } = gameEvent.params as {
        cell?: { r?: number; c?: number };
        id?: string;
      };
      if (cell && typeof cell.r === 'number' && typeof cell.c === 'number' && id) {
        updateCursor(id, cell.r, cell.c);
      }
    } else if (gameEvent.type === 'clockStart' && gameEvent.timestamp) {
      const state = useGameStore.getState();
      let baseElapsedTime = state.clock.elapsedTime;
      if (state.startTime) {
        const now = Date.now();
        const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
        baseElapsedTime = state.clock.elapsedTime + currentSessionSeconds;
      }
      useGameStore.setState({
        clock: { isRunning: true, elapsedTime: baseElapsedTime },
        startTime: gameEvent.timestamp,
      });
    } else if (gameEvent.type === 'clockPause' && gameEvent.timestamp) {
      const state = useGameStore.getState();
      if (state.startTime) {
        const currentSessionSeconds = Math.floor((gameEvent.timestamp - state.startTime) / 1000);
        const totalElapsedSeconds = state.clock.elapsedTime + currentSessionSeconds;
        useGameStore.setState({
          clock: { ...state.clock, isRunning: false, elapsedTime: totalElapsedSeconds },
          startTime: null,
        });
      } else {
        useGameStore.setState({
          clock: { ...state.clock, isRunning: false },
        });
      }
    } else if (gameEvent.type === 'clockReset') {
      gameClock.resetClock();
    } else if (gameEvent.type === 'puzzle_complete' || gameEvent.type === 'gameComplete') {
      setComplete(true);
      pauseClock();
    }
  });

  // Backward compatibility: cellUpdated event
  useSocketEvent('cellUpdated', (data: unknown) => {
    if (data && typeof data === 'object' && 'row' in data && 'col' in data && 'value' in data) {
      const { row, col, value, isPencil } = data as {
        row: unknown;
        col: unknown;
        value: unknown;
        isPencil?: unknown;
      };
      if (typeof row === 'number' && typeof col === 'number' && typeof value === 'string') {
        updateCell(row, col, value, Boolean(isPencil));
      }
    }
  });

  useSocketEvent('gameComplete', () => {
    setComplete(true);
    pauseClock();
  });

  // Cell update handler with optimistic updates
  const handleCellUpdate = useCallback(
    (row: number, col: number, value: string) => {
      if (!gameId || !user) {
        console.warn('[useGame] Cannot update cell - missing gameId or user');
        return;
      }

      // Store original state for rollback
      const originalValue = cells[row]?.[col]?.value || '';

      // Optimistic update
      updateCell(row, col, value, gameUI.isPencilMode);

      // Create update ID for tracking
      const updateId = `cell-${row}-${col}-${Date.now()}`;

      // Add to optimistic queue
      optimisticUpdateQueue.add({
        id: updateId,
        type: 'cell',
        timestamp: Date.now(),
        originalState: { row, col, value: originalValue },
        apply: () => {
          // Already applied optimistically
        },
        rollback: () => {
          updateCell(row, col, originalValue, false);
        },
        onSuccess: () => {
          // Update confirmed
        },
        onError: (error) => {
          console.error('[useGame] Cell update failed:', error);
        },
      });

      // Emit to server
      gameSocket.emitGameEvent({
        type: 'updateCell',
        user: user.id,
        timestamp: Date.now(),
        params: {
          cell: { r: row, c: col },
          value: value,
          autocheck: false,
          id: user.id,
        },
      });

      // Confirm update after a short delay (simulating server confirmation)
      // In real implementation, this would be confirmed by the server response
      setTimeout(() => {
        optimisticUpdateQueue.confirm(updateId);
      }, 100);
    },
    [gameId, user, gameUI.isPencilMode, updateCell, cells, gameSocket]
  );

  // Cell selection handler
  const handleCellSelect = useCallback(
    (row: number, col: number) => {
      gameUI.setSelectedCell(row, col);

      // Emit cursor position
      if (gameId && user) {
        gameSocket.emitGameEvent({
          type: 'updateCursor',
          user: user.id,
          timestamp: Date.now(),
          params: {
            id: user.id,
            cell: { r: row, c: col },
            timestamp: Date.now(),
          },
        });
      }
    },
    [gameId, user, gameUI, gameSocket]
  );

  // Clock handlers that emit events
  const handleStartClock = useCallback(() => {
    if (!gameId || !user) {
      gameClock.startClock();
      return;
    }

    const now = Date.now();
    const state = useGameStore.getState();
    let baseElapsedTime = state.clock.elapsedTime;
    if (state.startTime) {
      const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
      baseElapsedTime = state.clock.elapsedTime + currentSessionSeconds;
    }

    useGameStore.setState({
      clock: { isRunning: true, elapsedTime: baseElapsedTime },
      startTime: now,
    });

    gameSocket.emitGameEvent({
      type: 'clockStart',
      user: user.id,
      timestamp: now,
      params: {},
    });
  }, [gameId, user, gameClock, gameSocket]);

  const handlePauseClock = useCallback(() => {
    if (!gameId || !user) {
      gameClock.pauseClock();
      return;
    }

    const state = useGameStore.getState();
    const now = Date.now();

    if (state.startTime) {
      const currentSessionSeconds = Math.floor((now - state.startTime) / 1000);
      const totalElapsedSeconds = state.clock.elapsedTime + currentSessionSeconds;
      useGameStore.setState({
        clock: { ...state.clock, isRunning: false, elapsedTime: totalElapsedSeconds },
        startTime: null,
      });
    } else {
      gameClock.pauseClock();
    }

    gameSocket.emitGameEvent({
      type: 'clockPause',
      user: user.id,
      timestamp: now,
      params: {},
    });
  }, [gameId, user, gameClock, gameSocket]);

  const handleResetClock = useCallback(() => {
    gameClock.resetClock();

    if (gameId && user) {
      gameSocket.emitGameEvent({
        type: 'clockReset',
        user: user.id,
        timestamp: Date.now(),
        params: {},
      });
    }
  }, [gameId, user, gameClock, gameSocket]);

  return {
    gameId,
    cells,
    users,
    selectedCell: gameUI.selectedCell,
    selectedDirection: gameUI.selectedDirection,
    isPencilMode: gameUI.isPencilMode,
    isComplete,
    clock: {
      ...gameClock,
      elapsedTime: gameClock.elapsedTime,
    },
    isConnected: gameSocket.isConnected,
    isLoading: gameData.isLoading,
    loadError: gameData.loadError,
    handleCellUpdate,
    handleCellSelect,
    toggleDirection: gameUI.toggleDirection,
    togglePencilMode: gameUI.togglePencilMode,
    startClock: handleStartClock,
    pauseClock: handlePauseClock,
    resetClock: handleResetClock,
  };
};
