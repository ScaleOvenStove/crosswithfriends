/**
 * Chat Hook - Manages chat state and socket events
 * Implements REQ-2.2: Chat System
 *
 * Responsibilities:
 * - Manage chat messages
 * - Send/receive messages via socket
 * - Handle system messages
 */

import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@sockets/index';
import { useGameStore } from '@stores/gameStore';
import type { ChatMessageData } from '@components/Chat/ChatMessage';

interface UseChatProps {
  gameId: string | null;
  userId: string;
  userName: string;
  userColor: string;
}

interface UseChatResult {
  messages: ChatMessageData[];
  sendMessage: (message: string) => void;
  clearMessages: () => void;
}

/**
 * Hook for managing chat functionality
 */
export const useChat = ({ gameId, userId, userName, userColor }: UseChatProps): UseChatResult => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [hasSynced, setHasSynced] = useState(false);
  const { socket, isConnected } = useSocket();
  const { users } = useGameStore();

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !gameId) {
        console.warn('[Chat] Cannot send message - socket or gameId missing:', {
          hasSocket: !!socket,
          gameId,
        });
        return;
      }

      const timestamp = Date.now();
      const chatMessage: ChatMessageData = {
        id: `${userId}-${timestamp}`,
        userId,
        userName,
        userColor,
        message,
        timestamp,
      };

      // Add message locally (optimistic update)
      setMessages((prev) => {
        // Check if message already exists (shouldn't happen, but be safe)
        if (prev.some((msg) => msg.id === chatMessage.id)) {
          return prev;
        }
        return [...prev, chatMessage];
      });

      // Emit to server as a game event with correct structure
      // Include userName in params so other clients can display it (even though server doesn't validate it)
      const eventData = {
        gid: gameId,
        event: {
          type: 'sendChatMessage',
          user: userId,
          timestamp: Date.now(),
          params: {
            id: userId,
            message: message,
            sender: userName, // Include sender name for other clients
          },
        },
      };

      console.log('[Chat] Emitting sendChatMessage event:', {
        gameId,
        userId,
        userName,
        message,
        eventData,
      });

      socket.emit('game_event', eventData);
    },
    [socket, gameId, userId, userName, userColor]
  );

  /**
   * Add a system message
   */
  const addSystemMessage = useCallback((message: string) => {
    const systemMessage: ChatMessageData = {
      id: `system-${Date.now()}`,
      userId: 'system',
      userName: 'System',
      userColor: '#666',
      message,
      timestamp: Date.now(),
      isSystem: true,
    };

    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Reset sync flag when gameId changes
   */
  useEffect(() => {
    setHasSynced(false);
    setMessages([]); // Clear messages when switching games
  }, [gameId]);

  /**
   * Sync chat messages from game events when joining
   */
  useEffect(() => {
    if (!socket || !isConnected || !gameId || hasSynced) return;

    console.log('[Chat] Syncing chat messages for game:', gameId);

    // Join the game room first
    socket.emit('join_game', gameId, (response: { success?: boolean; error?: string }) => {
      if (response.error) {
        console.error('[Chat] Failed to join game for chat sync:', response.error);
        return;
      }

      if (response.success) {
        // Sync all game events to get chat history
        socket.emit('sync_all_game_events', gameId, (events: any[] | { error?: string }) => {
          if (Array.isArray(events)) {
            console.log('[Chat] Synced', events.length, 'game events, extracting chat messages');

            // Extract all sendChatMessage events and convert to chat messages
            const chatMessages: ChatMessageData[] = events
              .filter((event) => event.type === 'sendChatMessage' && event.params)
              .map((event) => {
                const eventUserId = event.params.id || event.user || '';
                // Look up user info from gameStore
                const senderUser = users.find((u) => u.id === eventUserId);
                const senderUserName = senderUser?.displayName || event.params.sender || event.user || 'Unknown';
                const senderUserColor = senderUser?.color || '#999';
                
                const chatMessage: ChatMessageData = {
                  id: `${eventUserId}-${event.timestamp || Date.now()}`,
                  userId: eventUserId,
                  userName: senderUserName,
                  userColor: senderUserColor,
                  message: event.params.message || '',
                  timestamp: event.timestamp || Date.now(),
                };
                return chatMessage;
              })
              .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp

            console.log('[Chat] Loaded', chatMessages.length, 'chat messages from history');
            setMessages(chatMessages);
            setHasSynced(true);
          } else if (events && typeof events === 'object' && 'error' in events) {
            console.error('[Chat] Failed to sync game events:', events.error);
          }
        });
      }
    });
  }, [socket, isConnected, gameId, hasSynced, users]);

  /**
   * Listen for incoming chat messages via game events
   */
  useEffect(() => {
    if (!socket) return;

    const handleGameEvent = (event: {
      type: string;
      params?: {
        message?: string;
        id?: string;
        sender?: string;
      };
      user?: string;
      timestamp?: number;
    }) => {
      console.log('[Chat] Received game_event:', {
        type: event.type,
        user: event.user,
        params: event.params,
        fullEvent: event,
      });

      // Handle chat messages from game events
      if (event.type === 'sendChatMessage' && event.params) {
        const eventTimestamp = event.timestamp || Date.now();
        const eventUserId = event.params.id || event.user || '';
        const messageId = `${eventUserId}-${eventTimestamp}`;
        
        // Look up user info from gameStore
        const senderUser = users.find((u) => u.id === eventUserId);
        const senderUserName = senderUser?.displayName || event.params.sender || event.user || 'Unknown';
        const senderUserColor = senderUser?.color || '#999';
        
        setMessages((prev) => {
          // Check for duplicates by ID
          if (prev.some((msg) => msg.id === messageId)) {
            console.log('[Chat] Message already exists, skipping:', messageId);
            return prev;
          }

          // Also check for duplicates by content and user (in case timestamps differ slightly)
          // This handles the case where optimistic update has slightly different timestamp
          // Only check for duplicates if this is from the current user (optimistic update)
          const isDuplicate = eventUserId === userId && prev.some(
            (msg) =>
              msg.userId === eventUserId &&
              msg.message === event.params.message &&
              Math.abs(msg.timestamp - eventTimestamp) < 1000 // Within 1 second
          );

          if (isDuplicate) {
            console.log('[Chat] Duplicate message detected (by content), skipping');
            return prev;
          }

          const chatMessage: ChatMessageData = {
            id: messageId,
            userId: eventUserId,
            userName: senderUserName,
            userColor: senderUserColor,
            message: event.params.message || '',
            timestamp: eventTimestamp,
          };

          console.log('[Chat] Adding chat message:', chatMessage);
          return [...prev, chatMessage];
        });
      } else {
        console.log('[Chat] Unhandled event type:', event.type);
      }
    };

    socket.on('game_event', handleGameEvent);

    return () => {
      socket.off('game_event', handleGameEvent);
    };
  }, [socket, userId, users]);

  return {
    messages,
    sendMessage,
    clearMessages,
  };
};
