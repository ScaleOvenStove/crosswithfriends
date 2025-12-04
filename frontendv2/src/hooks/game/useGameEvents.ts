/**
 * useGameEvents - Hook for handling game-specific socket events
 * Provides type-safe event emitters and listeners for game state
 */

import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '@sockets/index';

interface GameEvent {
  type: 'cell_fill' | 'cell_clear' | 'check' | 'reveal' | 'puzzle_complete';
  timestamp: number;
  id?: string;
  row?: number;
  col?: number;
  value?: string;
  [key: string]: unknown;
}

interface UseGameEventsOptions {
  gameId: string;
  onCellFill?: (event: GameEvent) => void;
  onCellClear?: (event: GameEvent) => void;
  onCheck?: (event: GameEvent) => void;
  onReveal?: (event: GameEvent) => void;
  onComplete?: (event: GameEvent) => void;
  enabled?: boolean;
}

export const useGameEvents = ({
  gameId,
  onCellFill,
  onCellClear,
  onCheck,
  onReveal,
  onComplete,
  enabled = true,
}: UseGameEventsOptions) => {
  const { socket, isConnected } = useSocket();
  const [isJoined, setIsJoined] = useState(false);
  const [eventQueue, setEventQueue] = useState<GameEvent[]>([]);

  // Join game room
  useEffect(() => {
    if (!socket || !isConnected || !enabled) return;

    socket.emit('join_game', gameId, (response: { success?: boolean; error?: string }) => {
      if (response.success) {
        setIsJoined(true);

        // Sync all game events on join
        socket.emit('sync_all_game_events', gameId, (events: GameEvent[]) => {
          if (Array.isArray(events)) {
            setEventQueue(events);
          }
        });
      } else {
        setIsJoined(false);
        const errorMessage = response.error || 'Failed to join game';
        console.error('[useGameEvents]', errorMessage);
      }
    });

    return () => {
      socket.emit('leave_game', gameId);
      setIsJoined(false);
    };
  }, [socket, isConnected, gameId, enabled]);

  // Listen for game events
  useEffect(() => {
    if (!socket || !isJoined) return;

    const handleGameEvent = (event: GameEvent) => {
      // Add to event queue
      setEventQueue((prev) => [...prev, event]);

      // Call specific handler based on event type
      switch (event.type) {
        case 'cell_fill':
          onCellFill?.(event);
          break;
        case 'cell_clear':
          onCellClear?.(event);
          break;
        case 'check':
          onCheck?.(event);
          break;
        case 'reveal':
          onReveal?.(event);
          break;
        case 'puzzle_complete':
          onComplete?.(event);
          break;
      }
    };

    socket.on('game_event', handleGameEvent);

    return () => {
      socket.off('game_event', handleGameEvent);
    };
  }, [socket, isJoined, onCellFill, onCellClear, onCheck, onReveal, onComplete]);

  // Emit game event
  const emitGameEvent = useCallback(
    (event: Omit<GameEvent, 'timestamp'>) => {
      if (!socket || !isJoined) return;

      const fullEvent: GameEvent = {
        ...event,
        timestamp: Date.now(),
      };

      socket.emit('game_event', {
        gid: gameId,
        event: fullEvent,
      });
    },
    [socket, isJoined, gameId]
  );

  // Emit cell fill event
  const emitCellFill = useCallback(
    (row: number, col: number, value: string, playerId: string) => {
      emitGameEvent({
        type: 'cell_fill',
        row,
        col,
        value,
        id: playerId,
      });
    },
    [emitGameEvent]
  );

  // Emit cell clear event
  const emitCellClear = useCallback(
    (row: number, col: number, playerId: string) => {
      emitGameEvent({
        type: 'cell_clear',
        row,
        col,
        id: playerId,
      });
    },
    [emitGameEvent]
  );

  // Emit check event
  const emitCheck = useCallback(
    (playerId: string) => {
      emitGameEvent({
        type: 'check',
        id: playerId,
      });
    },
    [emitGameEvent]
  );

  // Emit reveal event
  const emitReveal = useCallback(
    (playerId: string, row?: number, col?: number) => {
      emitGameEvent({
        type: 'reveal',
        id: playerId,
        row,
        col,
      });
    },
    [emitGameEvent]
  );

  // Emit puzzle complete event
  const emitComplete = useCallback(
    (playerId: string, time: number) => {
      emitGameEvent({
        type: 'puzzle_complete',
        id: playerId,
        time,
      });
    },
    [emitGameEvent]
  );

  return {
    isJoined,
    events: eventQueue,
    emitGameEvent,
    emitCellFill,
    emitCellClear,
    emitCheck,
    emitReveal,
    emitComplete,
  };
};

export default useGameEvents;
