// ============= Server Values ===========

import type {RoomEvent} from '@shared/roomEvents';
import {Server as SocketIOServer} from 'socket.io';

import type {GameEvent} from './model/game.js';
import {addGameEvent, getGameEvents} from './model/game.js';
import {addRoomEvent, getRoomEvents} from './model/room.js';

interface SocketEvent {
  [key: string]: unknown;
}

// Look for { .sv: 'timestamp' } and replace with Date.now()
function assignTimestamp(event: unknown): unknown {
  if (event && typeof event === 'object') {
    const eventObj = event as SocketEvent;
    if (eventObj['.sv'] === 'timestamp') {
      return Date.now();
    }
    const result = event.constructor();
    for (const key in eventObj) {
      result[key] = assignTimestamp(eventObj[key]);
    }
    return result;
  }
  return event;
}

// ============== Socket Manager ==============

class SocketManager {
  io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  async addGameEvent(gid: string, event: SocketEvent): Promise<void> {
    const gameEvent: GameEvent = assignTimestamp(event) as GameEvent;
    await addGameEvent(gid, gameEvent);
    this.io.to(`game-${gid}`).emit('game_event', gameEvent);
  }

  async addRoomEvent(rid: string, event: SocketEvent): Promise<void> {
    const roomEvent: RoomEvent = assignTimestamp(event) as RoomEvent;
    await addRoomEvent(rid, roomEvent);
    this.io.to(`room-${rid}`).emit('room_event', roomEvent);
  }

  listen(): void {
    this.io.on('connection', (socket) => {
      // ======== Ping/Pong for Latency Measurement ========= //
      // Use 'latency_ping' to avoid conflict with Socket.IO's internal 'ping' event
      socket.on('latency_ping', (clientTimestamp: number) => {
        try {
          if (typeof clientTimestamp !== 'number' || isNaN(clientTimestamp)) {
            console.warn('[socket] Invalid latency_ping timestamp:', clientTimestamp);
            return;
          }
          const serverTimestamp = Date.now();
          const latency = serverTimestamp - clientTimestamp;
          socket.emit('latency_pong', latency);
          // eslint-disable-next-line no-console
          console.log('[socket] Received latency_ping, responding with latency:', latency, 'ms');
        } catch (error) {
          console.error('[socket] Error handling latency_ping:', error);
        }
      });

      // ======== Game Events ========= //
      socket.on('join_game', (gid, ack) => {
        void socket.join(`game-${gid}`);
        void ack();
      });

      socket.on('leave_game', (gid, ack) => {
        void socket.leave(`game-${gid}`);
        void ack();
      });

      socket.on('sync_all_game_events', async (gid, ack) => {
        const events = await getGameEvents(gid);
        void ack(events);
      });

      socket.on('game_event', async (message, ack) => {
        await this.addGameEvent(message.gid, message.event);
        void ack();
      });

      // ======== Room Events ========= //

      socket.on('join_room', (rid, ack) => {
        void socket.join(`room-${rid}`);
        void ack();
      });
      socket.on('leave_room', (rid, ack) => {
        void socket.leave(`room-${rid}`);
        void ack();
      });

      socket.on('sync_all_room_events', async (rid, ack) => {
        const events = await getRoomEvents(rid);
        void ack(events);
      });

      socket.on('room_event', async (message, ack) => {
        await this.addRoomEvent(message.rid, message.event);
        void ack();
      });
    });
  }
}

export default SocketManager;
