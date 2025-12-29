/**
 * Hook for managing Socket.io event listeners
 * Implements REQ-10.3.2: Game events via WebSocket
 */

import { useEffect } from 'react';
import { useSocket } from './SocketContext';

type EventHandler = (...args: any[]) => void;

/**
 * Subscribe to socket events with automatic cleanup
 */
export const useSocketEvent = (event: string, handler: EventHandler) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
};

/**
 * Subscribe to multiple socket events
 */
export const useSocketEvents = (events: Record<string, EventHandler>) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, events]);
};

/**
 * Emit socket events
 */
export const useSocketEmit = () => {
  const { socket } = useSocket();

  return {
    emit: (event: string, ...args: any[]) => {
      if (!socket) {
        console.warn('[Socket] Cannot emit - socket not connected');
        return;
      }
      console.log('[Socket] Emitting event:', {
        event,
        args,
        socketConnected: socket.connected,
        socketId: socket.id,
      });
      socket.emit(event, ...args);
    },
    socket,
  };
};

export default useSocketEvent;
