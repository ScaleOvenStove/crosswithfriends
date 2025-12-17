/**
 * Hook for synchronizing game events
 * Handles event sync on join, deduplication, and state restoration
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@sockets/index';
import { useGameStore } from '@stores/gameStore';
import { useUser } from '@hooks/user/useUser';
import { safeValidateGameEvent, type GameEvent } from '@schemas/gameEventSchemas';
import { validateSyncEventsResponse } from '@schemas/apiSchemas';

interface UseGameEventSyncOptions {
  gameId: string | undefined;
  isConnected: boolean;
  hasLoadedPuzzle: boolean;
  socket: ReturnType<typeof useSocket>['socket'];
}

interface UseGameEventSyncReturn {
  hasSyncedEvents: boolean;
  syncEvents: () => Promise<void>;
}

/**
 * Deduplicates events by timestamp and type
 */
function deduplicateEvents(events: unknown[]): GameEvent[] {
  const seen = new Set<string>();
  const validEvents: GameEvent[] = [];

  for (const event of events) {
    const validation = safeValidateGameEvent(event);
    if (!validation.success) {
      console.warn('[useGameEventSync] Invalid event skipped:', validation.error);
      continue;
    }

    const eventData = validation.data!;
    // Create unique key from event properties
    const key = `${eventData.type}-${eventData.timestamp}-${eventData.user}-${JSON.stringify(eventData.params)}`;

    if (!seen.has(key)) {
      seen.add(key);
      validEvents.push(eventData);
    }
  }

  return validEvents;
}

export function useGameEventSync({
  gameId,
  isConnected,
  hasLoadedPuzzle,
  socket,
}: UseGameEventSyncOptions): UseGameEventSyncReturn {
  const { user } = useUser();
  const { updateCell, setComplete, pauseClock, resetClock } = useGameStore();
  const [hasSyncedEvents, setHasSyncedEvents] = useState(false);
  const syncInProgressRef = useRef(false);

  // Sync events when connected and puzzle is loaded
  const syncEvents = useCallback(async () => {
    if (
      !gameId ||
      !isConnected ||
      !hasLoadedPuzzle ||
      !socket ||
      !user ||
      syncInProgressRef.current
    ) {
      return;
    }

    syncInProgressRef.current = true;
    console.log('[useGameEventSync] Starting event sync for game:', gameId);

    try {
      // Request all game events
      socket.emit('sync_all_game_events', gameId, (response: unknown) => {
        const validated = validateSyncEventsResponse(response);

        if (Array.isArray(validated)) {
          console.log('[useGameEventSync] Received', validated.length, 'events');

          // Deduplicate events
          const deduplicated = deduplicateEvents(validated);
          console.log('[useGameEventSync] After deduplication:', deduplicated.length, 'events');

          // Sort by timestamp
          const sortedEvents = [...deduplicated].sort((a, b) => {
            return (a.timestamp || 0) - (b.timestamp || 0);
          });

          // Apply events
          applyEvents(sortedEvents);
        } else if (validated && typeof validated === 'object' && 'error' in validated) {
          console.error('[useGameEventSync] Sync error:', (validated as { error: string }).error);
        }

        setHasSyncedEvents(true);
        syncInProgressRef.current = false;
      });
    } catch (error) {
      console.error('[useGameEventSync] Failed to sync events:', error);
      setHasSyncedEvents(true);
      syncInProgressRef.current = false;
    }
  }, [
    gameId,
    isConnected,
    hasLoadedPuzzle,
    socket,
    user,
    updateCell,
    setComplete,
    pauseClock,
    resetClock,
  ]);

  // Apply events to restore game state
  const applyEvents = useCallback(
    (events: GameEvent[]) => {
      // Get current cells from store - using getState here is acceptable for one-time reads in callbacks
      // This is different from using it in render/effects which would bypass reactivity
      const cells = useGameStore.getState().cells;

      if (cells.length === 0) {
        // Retry after a short delay
        setTimeout(() => {
          const retryCells = useGameStore.getState().cells;
          if (retryCells.length > 0) {
            applyEvents(events);
          } else {
            console.warn('[useGameEventSync] Cells not ready, skipping event application');
            setHasSyncedEvents(true);
          }
        }, 100);
        return;
      }

      // Filter and apply updateCell events
      const updateCellEvents = events.filter((e) => e.type === 'updateCell');
      let appliedCount = 0;

      updateCellEvents.forEach((event) => {
        if (event.type === 'updateCell' && event.params) {
          const { cell, value } = event.params as {
            cell?: { r?: number; c?: number };
            value?: string;
          };
          if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
            // Validate bounds
            if (
              cell.r >= 0 &&
              cell.r < cells.length &&
              cell.c >= 0 &&
              cells[cell.r] &&
              cell.c < cells[cell.r].length
            ) {
              updateCell(cell.r, cell.c, value || '', false);
              appliedCount++;
            }
          }
        }
      });

      console.log('[useGameEventSync] Applied', appliedCount, 'cell updates');

      // Handle completion events
      const completeEvents = events.filter(
        (e) => e.type === 'puzzle_complete' || e.type === 'gameComplete'
      );
      if (completeEvents.length > 0) {
        setComplete(true);
        pauseClock();
      }

      // Handle clock events
      const clockEvents = events.filter(
        (e) => e.type === 'clockStart' || e.type === 'clockPause' || e.type === 'clockReset'
      );

      if (clockEvents.length > 0) {
        let clockState = {
          isRunning: false,
          elapsedTime: 0,
          lastStartTime: null as number | null,
        };

        clockEvents.forEach((event) => {
          if (!event.timestamp) return;

          if (event.type === 'clockReset') {
            clockState = { isRunning: false, elapsedTime: 0, lastStartTime: null };
          } else if (event.type === 'clockStart') {
            if (clockState.isRunning && clockState.lastStartTime) {
              const sessionSeconds = Math.floor(
                (event.timestamp - clockState.lastStartTime) / 1000
              );
              clockState.elapsedTime += sessionSeconds;
            }
            clockState.isRunning = true;
            clockState.lastStartTime = event.timestamp;
          } else if (event.type === 'clockPause') {
            if (clockState.isRunning && clockState.lastStartTime) {
              const sessionSeconds = Math.floor(
                (event.timestamp - clockState.lastStartTime) / 1000
              );
              clockState.elapsedTime += sessionSeconds;
            }
            clockState.isRunning = false;
            clockState.lastStartTime = null;
          }
        });

        const startTime =
          clockState.isRunning && clockState.lastStartTime ? clockState.lastStartTime : null;

        useGameStore.setState({
          clock: { isRunning: clockState.isRunning, elapsedTime: clockState.elapsedTime },
          startTime,
        });
      }
    },
    [updateCell, setComplete, pauseClock, resetClock]
  );

  // Auto-sync when conditions are met
  useEffect(() => {
    if (isConnected && gameId && user && hasLoadedPuzzle && socket && !hasSyncedEvents) {
      syncEvents();
    }
  }, [isConnected, gameId, user, hasLoadedPuzzle, socket, hasSyncedEvents, syncEvents]);

  // Reset sync flag when gameId changes
  useEffect(() => {
    setHasSyncedEvents(false);
    syncInProgressRef.current = false;
  }, [gameId]);

  return {
    hasSyncedEvents,
    syncEvents,
  };
}
