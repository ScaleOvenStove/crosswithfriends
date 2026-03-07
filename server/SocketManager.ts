// ============= Server Values ===========

import {RoomEvent} from '@shared/roomEvents';
import {Server} from 'socket.io';
import {addGameEvent, GameEvent, getGameEvents} from './model/game';
import {addRoomEvent, getRoomEvents} from './model/room';
import {verifyAccessToken} from './auth/jwt';

// Event types that are broadcast to connected clients but NOT persisted to the database.
// updateCursor and addPing are high-frequency and only meaningful in real-time.
// updateDisplayName and updateColor are persisted so players remain visible on reload.
const EPHEMERAL_EVENT_TYPES = new Set(['updateCursor', 'addPing']);

// ============== Socket Manager ==============

class SocketManager {
  io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async addGameEvent(gid: string, event: GameEvent) {
    if (!EPHEMERAL_EVENT_TYPES.has(event.type)) {
      await addGameEvent(gid, event);
    }
    this.io.to(`game-${gid}`).emit('game_event', event);
  }

  async addRoomEvent(rid: string, event: RoomEvent) {
    await addRoomEvent(rid, event);
    this.io.to(`room-${rid}`).emit('room_event', event);
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
        const event = message?.event;
        if (!event || typeof event.type !== 'string') {
          console.error('Invalid game_event: missing event or type');
          return;
        }
        // Replace Firebase-style sentinel timestamps with real server time
        if (typeof event.timestamp !== 'number') {
          event.timestamp = Date.now();
        }
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
        const event = message?.event;
        if (!event || typeof event.type !== 'string') {
          console.error('Invalid room_event: missing event or type');
          return;
        }
        if (typeof event.timestamp !== 'number') {
          event.timestamp = Date.now();
        }
        await this.addRoomEvent(message.rid, event);
        ack();
      });
    });
  }
}

export default SocketManager;
