// ============= Server Values ===========

import type {RoomEvent} from '@shared/roomEvents';
import {Server as SocketIOServer} from 'socket.io';

import type {GameEvent} from './model/game.js';
import {addGameEvent, getGameEvents} from './model/game.js';
import {addRoomEvent, getRoomEvents} from './model/room.js';
import {logger} from './utils/logger.js';
import {validateGameEvent} from './validation/gameEvents.js';
import {validateRoomEvent} from './validation/roomEvents.js';

interface SocketEvent {
  [key: string]: unknown;
}

// Look for { .sv: 'timestamp' } and replace with Date.now()
function assignTimestamp(event: unknown): unknown {
  if (event && typeof event === 'object') {
    const eventObj = event as SocketEvent;
    // Handle Firebase-style server timestamp placeholder
    if (eventObj['.sv'] === 'timestamp') {
      return Date.now();
    }
    // Handle arrays
    if (Array.isArray(eventObj)) {
      return eventObj.map((item) => assignTimestamp(item));
    }
    // Clone object properly
    const result: SocketEvent = {};
    for (const key in eventObj) {
      if (Object.prototype.hasOwnProperty.call(eventObj, key)) {
        result[key] = assignTimestamp(eventObj[key]);
      }
    }
    // Ensure timestamp field is always valid for event objects
    if ('timestamp' in result) {
      const timestamp = result.timestamp;
      if (
        timestamp == null ||
        typeof timestamp !== 'number' ||
        isNaN(timestamp) ||
        isNaN(new Date(timestamp).getTime())
      ) {
        logger.warn(
          {originalTimestamp: timestamp, eventType: result.type},
          'Invalid timestamp in event after assignTimestamp, setting to current time'
        );
        result.timestamp = Date.now();
      }
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

  async addGameEvent(gid: string, event: SocketEvent | GameEvent): Promise<void> {
    const gameEvent: GameEvent = assignTimestamp(event) as GameEvent;
    await addGameEvent(gid, gameEvent);
    this.io.to(`game-${gid}`).emit('game_event', gameEvent);
  }

  async addRoomEvent(rid: string, event: SocketEvent | RoomEvent): Promise<void> {
    const roomEvent: RoomEvent = assignTimestamp(event) as RoomEvent;
    await addRoomEvent(rid, roomEvent);
    this.io.to(`room-${rid}`).emit('room_event', roomEvent);
  }

  listen(): void {
    this.io.on('connection', (socket) => {
      // TODO: Add authentication middleware
      // - Verify user token on connection
      // - Attach authenticated user ID to socket instance
      // - Reject unauthenticated connections

      logger.info({socketId: socket.id}, '[socket] Client connected');

      // ======== Ping/Pong for Latency Measurement ========= //
      // Use 'latency_ping' to avoid conflict with Socket.IO's internal 'ping' event
      socket.on('latency_ping', (clientTimestamp: number) => {
        try {
          if (typeof clientTimestamp !== 'number' || isNaN(clientTimestamp)) {
            logger.warn({clientTimestamp}, '[socket] Invalid latency_ping timestamp');
            return;
          }
          const serverTimestamp = Date.now();
          const latency = serverTimestamp - clientTimestamp;
          socket.emit('latency_pong', latency);
          logger.debug({latency}, '[socket] Received latency_ping, responding with latency');
        } catch (error) {
          logger.error({err: error}, '[socket] Error handling latency_ping');
        }
      });

      // ======== Game Events ========= //
      socket.on('join_game', (gid, ack) => {
        try {
          // TODO: Verify user is authorized to join this game
          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in join_game');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }
          void socket.join(`game-${gid}`);
          logger.debug({gid, socketId: socket.id}, '[socket] Client joined game');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, gid}, '[socket] Error handling join_game');
          if (ack) void ack({error: 'Failed to join game'});
        }
      });

      socket.on('leave_game', (gid, ack) => {
        try {
          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in leave_game');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }
          void socket.leave(`game-${gid}`);
          logger.debug({gid, socketId: socket.id}, '[socket] Client left game');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, gid}, '[socket] Error handling leave_game');
          if (ack) void ack({error: 'Failed to leave game'});
        }
      });

      socket.on('sync_all_game_events', async (gid, ack) => {
        try {
          // TODO: Verify user is authorized to access this game
          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in sync_all_game_events');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }
          const events = await getGameEvents(gid);
          logger.debug({gid, eventCount: events.length}, '[socket] Syncing game events');
          if (ack) void ack(events);
        } catch (error) {
          logger.error({err: error, gid}, '[socket] Error syncing game events');
          if (ack) void ack({error: 'Failed to sync game events'});
        }
      });

      socket.on('game_event', async (message, ack) => {
        try {
          // Validate message structure
          if (!message || typeof message !== 'object') {
            logger.warn({message}, '[socket] Invalid message structure in game_event');
            if (ack) void ack({error: 'Invalid message structure'});
            return;
          }

          const {gid, event} = message;

          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in game_event');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }

          // TODO: Verify user is authorized to emit events for this game
          // TODO: Verify the event's 'id' field matches the authenticated user ID

          // Validate event using Zod schema
          const validation = validateGameEvent(event);
          if (!validation.valid) {
            logger.warn({gid, error: validation.error, event}, '[socket] Invalid game event');
            if (ack) void ack({error: validation.error});
            return;
          }

          await this.addGameEvent(gid, validation.validatedEvent as GameEvent);
          logger.debug({gid, eventType: event.type}, '[socket] Game event processed');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, message}, '[socket] Error handling game_event');
          if (ack) void ack({error: 'Failed to process game event'});
        }
      });

      // ======== Room Events ========= //

      socket.on('join_room', (rid, ack) => {
        try {
          // TODO: Verify user is authorized to join this room
          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in join_room');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }
          void socket.join(`room-${rid}`);
          logger.debug({rid, socketId: socket.id}, '[socket] Client joined room');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, rid}, '[socket] Error handling join_room');
          if (ack) void ack({error: 'Failed to join room'});
        }
      });

      socket.on('leave_room', (rid, ack) => {
        try {
          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in leave_room');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }
          void socket.leave(`room-${rid}`);
          logger.debug({rid, socketId: socket.id}, '[socket] Client left room');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, rid}, '[socket] Error handling leave_room');
          if (ack) void ack({error: 'Failed to leave room'});
        }
      });

      socket.on('sync_all_room_events', async (rid, ack) => {
        try {
          // TODO: Verify user is authorized to access this room
          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in sync_all_room_events');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }
          const events = await getRoomEvents(rid);
          logger.debug({rid, eventCount: events.length}, '[socket] Syncing room events');
          if (ack) void ack(events);
        } catch (error) {
          logger.error({err: error, rid}, '[socket] Error syncing room events');
          if (ack) void ack({error: 'Failed to sync room events'});
        }
      });

      socket.on('room_event', async (message, ack) => {
        try {
          // Validate message structure
          if (!message || typeof message !== 'object') {
            logger.warn({message}, '[socket] Invalid message structure in room_event');
            if (ack) void ack({error: 'Invalid message structure'});
            return;
          }

          const {rid, event} = message;

          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in room_event');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }

          // TODO: Verify user is authorized to emit events for this room
          // TODO: Verify the event's 'uid' field matches the authenticated user ID

          // Validate event using Zod schema
          const validation = validateRoomEvent(event);
          if (!validation.valid) {
            logger.warn({rid, error: validation.error, event}, '[socket] Invalid room event');
            if (ack) void ack({error: validation.error});
            return;
          }

          await this.addRoomEvent(rid, validation.validatedEvent as RoomEvent);
          logger.debug({rid, eventType: event.type}, '[socket] Room event processed');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, message}, '[socket] Error handling room_event');
          if (ack) void ack({error: 'Failed to process room event'});
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info({socketId: socket.id, reason}, '[socket] Client disconnected');
      });

      socket.on('error', (error) => {
        logger.error({socketId: socket.id, err: error}, '[socket] Socket error');
      });
    });
  }
}

export default SocketManager;
