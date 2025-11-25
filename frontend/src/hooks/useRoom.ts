/**
 * Custom hook for room management
 * Provides room state and actions
 */

import type {RoomEvent} from '@crosswithfriends/shared/roomEvents';
import {UserPingRoomEvent, SetGameRoomEvent} from '@crosswithfriends/shared/roomEvents';
import {useCallback, useEffect, useState, Dispatch, SetStateAction} from 'react';

import {emitAsync} from '../sockets/emitAsync';
import {useSocket} from '../sockets/useSocket';

import {useUser} from './useUser';

interface UseRoomOptions {
  rid: string;
  onEventsChange?: (events: RoomEvent[]) => void;
}

interface UseRoomReturn {
  events: RoomEvent[];
  sendUserPing: () => Promise<void>;
  setGame: (gid: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

// Helper function to subscribe to room events (extracted from Room.tsx pattern)
function subscribeToRoomEvents(
  socket: ReturnType<typeof useSocket> | undefined,
  rid: string,
  setEvents: Dispatch<SetStateAction<RoomEvent[]>>
): {syncPromise: Promise<void>; unsubscribe: () => void} {
  let connected = false;
  const roomEventHandler = (event: RoomEvent) => {
    if (!connected) return;
    setEvents((events) => [...events, event]);
  };

  async function joinAndSync() {
    if (!socket) return;
    await emitAsync(socket, 'join_room', rid);
    socket.on('room_event', roomEventHandler);
    const allEvents: RoomEvent[] = (await emitAsync(socket, 'sync_all_room_events', rid)) as RoomEvent[];
    setEvents(allEvents);
    connected = true;
  }
  function unsubscribe() {
    if (!socket) return;
    // Remove the event listener to prevent memory leaks
    socket.off('room_event', roomEventHandler);
    emitAsync(socket, 'leave_room', rid);
  }
  const syncPromise = joinAndSync();

  return {syncPromise, unsubscribe};
}

export function useRoom(options: UseRoomOptions): UseRoomReturn {
  const {rid, onEventsChange} = options;
  const socket = useSocket();
  const user = useUser();
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!socket) return;

    let mounted = true;
    // Use setTimeout to avoid calling setState synchronously in effect
    setTimeout(() => {
      if (mounted) {
        setLoading(true);
      }
    }, 0);
    const {syncPromise, unsubscribe} = subscribeToRoomEvents(socket, rid, setEvents);
    syncPromise
      .then(() => {
        if (mounted) {
          // Events are already set by subscribeToRoomEvents, just update loading
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to sync room events'));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [rid, socket]);

  useEffect(() => {
    if (onEventsChange) {
      onEventsChange(events);
    }
  }, [events, onEventsChange]);

  const sendUserPing = useCallback(async () => {
    if (!socket || !user.id) return;
    try {
      const event = UserPingRoomEvent(user.id);
      await emitAsync(socket, 'room_event', {rid, event});
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send user ping'));
    }
  }, [socket, rid, user.id]);

  const setGame = useCallback(
    async (gid: string) => {
      if (!socket || !user.id) return;
      try {
        const event = SetGameRoomEvent(gid, user.id);
        await emitAsync(socket, 'room_event', {rid, event});
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to set game'));
      }
    },
    [socket, rid, user.id]
  );

  return {
    events,
    sendUserPing,
    setGame,
    loading,
    error,
  };
}
