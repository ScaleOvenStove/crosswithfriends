/**
 * Hook for socket connection and management
 * Handles socket lifecycle, connection status, and event emission
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSocket, useSocketEmit } from '@sockets/index';
import { useGameStore } from '@stores/gameStore';
import { socketRecoveryService } from '@services/socketRecoveryService';
import { optimisticUpdateQueue as _optimisticUpdateQueue } from '@services/optimisticUpdateQueue';
import { validateSocketGameEvent, safeValidateGameEvent } from '@schemas/gameEventSchemas';
import { validateJoinGameResponse } from '@schemas/apiSchemas';
import type { Socket } from 'socket.io-client';

interface UseGameSocketReturn {
  isConnected: boolean;
  socket: Socket | null;
  emitGameEvent: (
    event: {
      type: string;
      user: string;
      timestamp: number;
      params: Record<string, unknown>;
    },
    ack?: (response: { success?: boolean; error?: string }) => void
  ) => void;
  joinGame: (gameId: string, onSuccess?: () => void, onError?: (error: string) => void) => void;
}

export function useGameSocket(gameId: string | undefined): UseGameSocketReturn {
  const { connect, disconnect, isConnected, socket } = useSocket();
  const { emit } = useSocketEmit();
  const { setGameId } = useGameStore();
  const hasJoinedRef = useRef(false);

  // Join game room - defined before effects that use it
  const joinGame = useCallback(
    (gid: string, onSuccess?: () => void, onError?: (error: string) => void) => {
      if (!socket || !isConnected) {
        const error = 'Socket not connected';
        console.error('[useGameSocket]', error);
        onError?.(error);
        return;
      }

      socket.emit('join_game', gid, (response: { success?: boolean; error?: string }) => {
        const validated = validateJoinGameResponse(response);
        if (validated.error) {
          console.error('[useGameSocket] Failed to join game:', validated.error);
          onError?.(validated.error);
          return;
        }

        if (validated.success) {
          // Successfully joined game
          hasJoinedRef.current = true;
          onSuccess?.();
        }
      });
    },
    [socket, isConnected]
  );

  // Set up recovery service callbacks
  useEffect(() => {
    socketRecoveryService.setConnectionChangeCallback((_connected) => {
      // Connection status changes are handled by the service
    });

    return () => {
      socketRecoveryService.setConnectionChangeCallback(() => {});
    };
  }, []);

  // Connect socket when game mounts
  useEffect(() => {
    if (gameId) {
      setGameId(gameId);
      // Connect socket for game
      connect();
    }

    return () => {
      // Disconnect socket on cleanup
      disconnect();
      hasJoinedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Handle socket events for recovery
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = (reason: string) => {
      socketRecoveryService.handleDisconnect(reason);
      hasJoinedRef.current = false;
    };

    const handleReconnect = async () => {
      if (gameId) {
        await socketRecoveryService.handleReconnect(socket, gameId);
        // Re-join game after reconnection
        if (!hasJoinedRef.current) {
          joinGame(gameId);
        }
      }
    };

    const handleReconnectAttempt = (attempt: number) => {
      socketRecoveryService.handleReconnectAttempt(attempt);
    };

    const handleReconnectFailed = () => {
      socketRecoveryService.handleReconnectFailed();
    };

    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleReconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);

    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleReconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket, gameId, joinGame]);

  // Emit game event with validation and optimistic update support
  const emitGameEvent = useCallback(
    (
      event: {
        type: string;
        user: string | null;
        timestamp: number;
        params: Record<string, unknown>;
      },
      ack?: (response: { success?: boolean; error?: string }) => void
    ) => {
      if (!gameId || !socket || !isConnected) {
        console.warn('[useGameSocket] Cannot emit event - not connected or no gameId');
        if (ack) {
          ack({ error: 'Socket not connected' });
        }
        return;
      }

      // Validate event
      const validation = safeValidateGameEvent(event);
      if (!validation.success || !validation.data) {
        console.error('[useGameSocket] Invalid event:', validation.error);
        if (ack) {
          ack({ error: validation.error?.message || 'Invalid event' });
        }
        return;
      }

      const eventData = {
        gid: gameId,
        event: validation.data,
      };

      try {
        // Validate socket event wrapper
        validateSocketGameEvent(eventData);

        // Emit with acknowledgment callback if provided
        if (ack) {
          socket.emit(
            'game_event',
            eventData,
            (response: { success?: boolean; error?: string }) => {
              ack(response);
            }
          );
        } else {
          emit('game_event', eventData);
        }
        // Event emitted successfully
      } catch (error) {
        console.error('[useGameSocket] Failed to emit event:', error);
        if (ack) {
          ack({ error: error instanceof Error ? error.message : 'Failed to emit event' });
        }
        // Queue event for retry
        socketRecoveryService.queueEvent('game_event', eventData);
      }
    },
    [gameId, socket, isConnected, emit]
  );

  return {
    isConnected,
    socket,
    emitGameEvent,
    joinGame,
  };
}
