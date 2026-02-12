// ============= Server Values ===========

import {RoomEvent} from '@shared/roomEvents';
import {Server} from 'socket.io';
import {addGameEvent, GameEvent, getGameEvents} from './model/game';
import {addRoomEvent, getRoomEvents} from './model/room';
import {verifyAccessToken} from './auth/jwt';

interface SocketEvent {
  [key: string]: any;
}

// Look for { .sv: 'timestamp' } and relpcae with Date.now()
function assignTimestamp(event: SocketEvent) {
  if (event && typeof event === 'object') {
    if (event['.sv'] === 'timestamp') {
      return Date.now();
    }
    const result = event.constructor();
    // eslint-disable-next-line guard-for-in
    for (const key in event) {
      result[key] = assignTimestamp(event[key]);
    }
    return result;
  }
  return event;
}

// ============== Socket Manager ==============

class SocketManager {
  io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async addGameEvent(gid: string, event: SocketEvent) {
    const gameEvent: GameEvent = assignTimestamp(event);
    await addGameEvent(gid, gameEvent);
    this.io.to(`game-${gid}`).emit('game_event', gameEvent);
  }

  async addRoomEvent(rid: string, event: SocketEvent) {
    const roomEvent: RoomEvent = assignTimestamp(event);
    await addRoomEvent(rid, roomEvent);
    this.io.to(`room-${rid}`).emit('room_event', roomEvent);
  }

  listen() {
    // Auth middleware: verify JWT on connection if provided (guests still allowed)
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
          socket.data.authUser = payload;
        }
      }
      next();
    });

    this.io.on('connection', (socket) => {
      // ======== Game Events ========= //
      // NOTICE: join is deprecated in favor of sync_all_game_events
      // TODO remove once #142 is fully deployed
      socket.on('join', async (gid, ack) => {
        socket.join(`game-${gid}`);
        ack();
      });

      socket.on('join_game', async (gid, ack) => {
        socket.join(`game-${gid}`);
        ack();
      });

      socket.on('leave_game', async (gid, ack) => {
        socket.leave(`game-${gid}`);
        ack();
      });

      // NOTICE: sync_all is deprecated in favor of sync_all_game_events
      // TODO remove once #142 is fully deployed
      socket.on('sync_all', async (gid, ack) => {
        const events = await getGameEvents(gid);
        ack(events);
      });

      socket.on('sync_all_game_events', async (gid, ack) => {
        const events = await getGameEvents(gid);
        ack(events);
      });

      socket.on('game_event', async (message, ack) => {
        const event = message.event;
        // Stamp verified user identity if authenticated
        if (socket.data.authUser) {
          event.verifiedUserId = socket.data.authUser.userId;
        }
        await this.addGameEvent(message.gid, event);
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
