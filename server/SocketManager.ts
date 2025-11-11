// ============= Server Values ===========

import type {RoomEvent} from '@shared/roomEvents';
import {Server as SocketIOServer} from 'socket.io';
import {addGameEvent, getGameEvents} from './model/game.js';
import type {GameEvent} from './model/game.js';
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
    // eslint-disable-next-line guard-for-in
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

  async addGameEvent(gid: string, event: SocketEvent) {
    const gameEvent: GameEvent = assignTimestamp(event) as GameEvent;
    await addGameEvent(gid, gameEvent);
    this.io.to(`game-${gid}`).emit('game_event', gameEvent);
  }

  async addRoomEvent(rid: string, event: SocketEvent) {
    const roomEvent: RoomEvent = assignTimestamp(event) as RoomEvent;
    await addRoomEvent(rid, roomEvent);
    this.io.to(`room-${rid}`).emit('room_event', roomEvent);
  }

  listen() {
    this.io.on('connection', (socket) => {
      // ======== Game Events ========= //
      socket.on('join_game', async (gid, ack) => {
        socket.join(`game-${gid}`);
        ack();
      });

      socket.on('leave_game', async (gid, ack) => {
        socket.leave(`game-${gid}`);
        ack();
      });

      socket.on('sync_all_game_events', async (gid, ack) => {
        const events = await getGameEvents(gid);
        ack(events);
      });

      socket.on('game_event', async (message, ack) => {
        await this.addGameEvent(message.gid, message.event);
        ack();
      });

      // ======== Room Events ========= //

      socket.on('join_room', async (rid, ack) => {
        socket.join(`room-${rid}`);
        ack();
      });
      socket.on('leave_room', async (rid, ack) => {
        socket.leave(`room-${rid}`);
        ack();
      });

      socket.on('sync_all_room_events', async (rid, ack) => {
        const events = await getRoomEvents(rid);
        ack(events);
      });

      socket.on('room_event', async (message, ack) => {
        await this.addRoomEvent(message.rid, message.event);
        ack();
      });
    });
  }
}

export default SocketManager;
