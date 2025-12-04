/**
 * useRoomEvents - Hook for handling room-specific socket events
 * Manages room-level events like user presence and chat
 */

import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '@sockets/index';

interface RoomEvent {
  type: 'user_join' | 'user_leave' | 'chat_message' | 'presence_update';
  timestamp: number;
  uid: string;
  displayName?: string;
  message?: string;
  status?: 'online' | 'offline' | 'away';
  [key: string]: unknown;
}

interface UseRoomEventsOptions {
  roomId: string;
  onUserJoin?: (event: RoomEvent) => void;
  onUserLeave?: (event: RoomEvent) => void;
  onChatMessage?: (event: RoomEvent) => void;
  onPresenceUpdate?: (event: RoomEvent) => void;
  enabled?: boolean;
}

export const useRoomEvents = ({
  roomId,
  onUserJoin,
  onUserLeave,
  onChatMessage,
  onPresenceUpdate,
  enabled = true,
}: UseRoomEventsOptions) => {
  const { socket, isConnected } = useSocket();
  const [isJoined, setIsJoined] = useState(false);
  const [roomUsers, setRoomUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<RoomEvent[]>([]);

  // Join room
  useEffect(() => {
    if (!socket || !isConnected || !enabled) return;

    socket.emit('join_room', roomId, (response: { success?: boolean; error?: string }) => {
      if (response.success) {
        setIsJoined(true);

        // Sync all room events
        socket.emit('sync_all_room_events', roomId, (events: RoomEvent[]) => {
          if (Array.isArray(events)) {
            // Extract chat messages
            const chatMessages = events.filter((e) => e.type === 'chat_message');
            setMessages(chatMessages);

            // Compute latest event per uid (sort by timestamp, keep latest)
            const eventsByUid = new Map<string, RoomEvent>();
            events.forEach((event) => {
              const existing = eventsByUid.get(event.uid);
              if (!existing || (event.timestamp && existing.timestamp && event.timestamp > existing.timestamp)) {
                eventsByUid.set(event.uid, event);
              }
            });

            // Build users list from uids whose latest event is user_join
            const users = Array.from(eventsByUid.entries())
              .filter(([_, event]) => event.type === 'user_join')
              .map(([uid]) => uid);
            setRoomUsers(users);
          }
        });
      }
    });

    return () => {
      socket.emit('leave_room', roomId);
      setIsJoined(false);
    };
  }, [socket, isConnected, roomId, enabled]);

  // Listen for room events
  useEffect(() => {
    if (!socket || !isJoined) return;

    const handleRoomEvent = (event: RoomEvent) => {
      switch (event.type) {
        case 'user_join':
          setRoomUsers((prev) => {
            if (prev.includes(event.uid)) return prev;
            return [...prev, event.uid];
          });
          onUserJoin?.(event);
          break;

        case 'user_leave':
          setRoomUsers((prev) => prev.filter((uid) => uid !== event.uid));
          onUserLeave?.(event);
          break;

        case 'chat_message':
          setMessages((prev) => [...prev, event]);
          onChatMessage?.(event);
          break;

        case 'presence_update':
          onPresenceUpdate?.(event);
          break;
      }
    };

    socket.on('room_event', handleRoomEvent);

    return () => {
      socket.off('room_event', handleRoomEvent);
    };
  }, [socket, isJoined, onUserJoin, onUserLeave, onChatMessage, onPresenceUpdate]);

  // Emit room event
  const emitRoomEvent = useCallback(
    (event: Omit<RoomEvent, 'timestamp'>) => {
      if (!socket || !isJoined) return;

      const fullEvent: RoomEvent = {
        ...event,
        timestamp: Date.now(),
      };

      socket.emit('room_event', {
        rid: roomId,
        event: fullEvent,
      });
    },
    [socket, isJoined, roomId]
  );

  // Send chat message
  const sendChatMessage = useCallback(
    (userId: string, userName: string, message: string) => {
      emitRoomEvent({
        type: 'chat_message',
        uid: userId,
        displayName: userName,
        message,
      });
    },
    [emitRoomEvent]
  );

  // Update presence
  const updatePresence = useCallback(
    (userId: string, status: 'online' | 'offline' | 'away') => {
      emitRoomEvent({
        type: 'presence_update',
        uid: userId,
        status,
      });
    },
    [emitRoomEvent]
  );

  return {
    isJoined,
    roomUsers,
    messages,
    emitRoomEvent,
    sendChatMessage,
    updatePresence,
  };
};

export default useRoomEvents;
