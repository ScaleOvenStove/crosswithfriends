// ============= Server Values ===========

import {RoomEvent} from '@shared/roomEvents';
import * as Sentry from '@sentry/node';
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
      socket.on('join_game', async (gid, ack) => {
        try {
          if (typeof gid !== 'string' || !gid) {
            if (typeof ack === 'function') ack({error: 'invalid gid'});
            return;
          }
          socket.join(`game-${gid}`);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] join_game error for gid=${gid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack({error: 'internal error'});
        }
      });

      socket.on('leave_game', async (gid, ack) => {
        try {
          if (typeof gid !== 'string' || !gid) {
            if (typeof ack === 'function') ack({error: 'invalid gid'});
            return;
          }
          socket.leave(`game-${gid}`);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] leave_game error for gid=${gid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack({error: 'internal error'});
        }
      });

      socket.on('sync_all_game_events', async (gid, ack) => {
        try {
          if (typeof gid !== 'string' || !gid) {
            if (typeof ack === 'function') ack({error: 'invalid gid'});
            return;
          }
          const events = await getGameEvents(gid);
          if (typeof ack === 'function') ack(events);
        } catch (err) {
          console.error(`[Socket] sync_all_game_events error for gid=${gid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack([]);
        }
      });

      socket.on('game_event', async (message, ack) => {
        try {
          const event = message?.event;
          if (!event || typeof event.type !== 'string') {
            console.error('Invalid game_event: missing event or type');
            if (typeof ack === 'function') ack({error: 'invalid event'});
            return;
          }
          if (typeof message.gid !== 'string' || !message.gid) {
            console.error('Invalid game_event: missing or invalid gid');
            if (typeof ack === 'function') ack({error: 'invalid gid'});
            return;
          }
          // Replace non-numeric timestamps with real server time
          if (typeof event.timestamp !== 'number') {
            event.timestamp = Date.now();
          }
          // Stamp verified user identity if authenticated, otherwise clear it
          // to prevent unauthenticated users from spoofing verifiedUserId
          if (socket.data.authUser) {
            event.verifiedUserId = socket.data.authUser.userId;
          } else {
            delete event.verifiedUserId;
          }
          await this.addGameEvent(message.gid, event);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] game_event error:`, err);
          Sentry.captureException(err);
          // Don't ack — let client timeout trigger retry for transient failures
        }
      });

      // ======== Room Events ========= //

      socket.on('join_room', async (rid, ack) => {
        try {
          if (typeof rid !== 'string' || !rid) {
            if (typeof ack === 'function') ack({error: 'invalid rid'});
            return;
          }
          socket.join(`room-${rid}`);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] join_room error for rid=${rid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack({error: 'internal error'});
        }
      });

      socket.on('leave_room', async (rid, ack) => {
        try {
          if (typeof rid !== 'string' || !rid) {
            if (typeof ack === 'function') ack({error: 'invalid rid'});
            return;
          }
          socket.leave(`room-${rid}`);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] leave_room error for rid=${rid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack({error: 'internal error'});
        }
      });

      socket.on('sync_all_room_events', async (rid, ack) => {
        try {
          if (typeof rid !== 'string' || !rid) {
            if (typeof ack === 'function') ack({error: 'invalid rid'});
            return;
          }
          const events = await getRoomEvents(rid);
          if (typeof ack === 'function') ack(events);
        } catch (err) {
          console.error(`[Socket] sync_all_room_events error for rid=${rid}:`, err);
          Sentry.captureException(err);
          if (typeof ack === 'function') ack([]);
        }
      });

      socket.on('room_event', async (message, ack) => {
        try {
          const event = message?.event;
          if (!event || typeof event.type !== 'string') {
            console.error('Invalid room_event: missing event or type');
            if (typeof ack === 'function') ack({error: 'invalid event'});
            return;
          }
          if (typeof message.rid !== 'string' || !message.rid) {
            console.error('Invalid room_event: missing or invalid rid');
            if (typeof ack === 'function') ack({error: 'invalid rid'});
            return;
          }
          if (typeof event.timestamp !== 'number') {
            event.timestamp = Date.now();
          }
          await this.addRoomEvent(message.rid, event);
          if (typeof ack === 'function') ack();
        } catch (err) {
          console.error(`[Socket] room_event error:`, err);
          Sentry.captureException(err);
          // Don't ack — let client timeout trigger retry for transient failures
        }
      });
    });
  }
}

export default SocketManager;
