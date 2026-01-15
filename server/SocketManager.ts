// ============= Server Values ===========

import type {RoomEvent} from '@crosswithfriends/shared/roomEvents';
import {Server as SocketIOServer} from 'socket.io';

import {config} from './config/index.js';
import type {GameEvent} from './model/game.js';
import {addGameEvent, getGameEvents} from './model/game.js';
import type {DatabasePool} from './model/pool.js';
import {addRoomEvent, getRoomEvents} from './model/room.js';
import type {IGameRepository} from './repositories/interfaces/IGameRepository.js';
import type {IRoomRepository} from './repositories/interfaces/IRoomRepository.js';
import {getOrCreateCorrelationId} from './utils/correlationId.js';
import {logger} from './utils/logger.js';
import {isArray, isObject, isString} from './utils/typeGuards.js';
import {
  authenticateSocket,
  isUserAuthorizedForGame,
  isUserAuthorizedForRoom,
  isValidUserId,
  type AuthorizationResult,
} from './utils/userAuth.js';
import {checkRateLimit, cleanupRateLimitState} from './utils/websocketRateLimit.js';
import {validateGameEvent} from './validation/gameEvents.js';
import {validateRoomEvent} from './validation/roomEvents.js';

interface SocketEvent {
  [key: string]: unknown;
}

interface SocketManagerRepositories {
  game: IGameRepository;
  room: IRoomRepository;
}

// Look for { .sv: 'timestamp' } and replace with Date.now()
function assignTimestamp(event: unknown): unknown {
  if (isArray(event)) {
    return event.map((item) => assignTimestamp(item));
  }
  if (isObject(event)) {
    // Handle Firebase-style server timestamp placeholder
    if (event['.sv'] === 'timestamp' && Object.keys(event).length === 1) {
      return Date.now();
    }

    const result: SocketEvent = {};
    if (event['.sv'] === 'timestamp' && !('timestamp' in event)) {
      result.timestamp = Date.now();
    }
    for (const key in event) {
      if (Object.prototype.hasOwnProperty.call(event, key)) {
        if (key === '.sv') {
          continue;
        }
        result[key] = assignTimestamp(event[key]);
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
  private db: DatabasePool;
  private repositories: SocketManagerRepositories | null = null;

  constructor(io: SocketIOServer, db: DatabasePool, repositories?: SocketManagerRepositories) {
    this.io = io;
    this.db = db;
    if (repositories) {
      this.repositories = repositories;
    }
  }

  /**
   * Set repositories for authorization checks
   * Can be called after construction if repositories aren't available at construct time
   */
  setRepositories(repositories: SocketManagerRepositories): void {
    this.repositories = repositories;
  }

  async addGameEvent(gid: string, event: SocketEvent | GameEvent): Promise<void> {
    const timestamped = assignTimestamp(event);
    const validation = validateGameEvent(timestamped);
    if (!validation.valid || !validation.validatedEvent) {
      logger.warn({gid, error: validation.error}, 'Rejected invalid game event');
      return;
    }
    await addGameEvent(this.db, gid, validation.validatedEvent);
    this.io.to(`game-${gid}`).emit('game_event', validation.validatedEvent);
  }

  async addRoomEvent(rid: string, event: SocketEvent | RoomEvent): Promise<void> {
    const timestamped = assignTimestamp(event);
    const validation = validateRoomEvent(timestamped);
    if (!validation.valid || !validation.validatedEvent) {
      logger.warn({rid, error: validation.error}, 'Rejected invalid room event');
      return;
    }
    await addRoomEvent(this.db, rid, validation.validatedEvent);
    this.io.to(`room-${rid}`).emit('room_event', validation.validatedEvent);
  }

  /**
   * Check if user is authorized to access a game
   * Returns AuthorizationResult with detailed reason
   */
  private async checkGameAuthorization(gid: string, userId: string): Promise<AuthorizationResult> {
    if (!this.repositories) {
      // If no repositories configured, allow access (backward compatibility)
      logger.warn({gid, userId}, 'No repositories configured, skipping authorization check');
      return {authorized: true, reason: 'participant'};
    }

    const repos = this.repositories;
    return await isUserAuthorizedForGame(
      userId,
      gid,
      (gameId) => repos.game.getCreator(gameId),
      (gameId) => repos.game.exists(gameId)
    );
  }

  /**
   * Check if user is authorized to access a room
   * Returns AuthorizationResult with detailed reason
   */
  private async checkRoomAuthorization(rid: string, userId: string): Promise<AuthorizationResult> {
    if (!this.repositories) {
      // If no repositories configured, allow access (backward compatibility)
      logger.warn({rid, userId}, 'No repositories configured, skipping authorization check');
      return {authorized: true, reason: 'participant'};
    }

    const repos = this.repositories;
    return await isUserAuthorizedForRoom(
      userId,
      rid,
      (roomId) => repos.room.getCreator(roomId),
      (roomId) => repos.room.exists(roomId)
    );
  }

  listen(): void {
    this.io.on('connection', (socket) => {
      // Extract and validate user using token-based auth
      // In development mode (REQUIRE_AUTH=false), allow connections without authentication
      let userId: string | null = null;
      const authResult = authenticateSocket(socket);

      if (authResult.authenticated && authResult.userId) {
        userId = authResult.userId;
      } else if (config.auth.requireAuth) {
        // In production, require authentication
        logger.warn(
          {socketId: socket.id, error: authResult.error},
          '[socket] Connection rejected: authentication failed'
        );
        socket.emit('auth_error', {error: authResult.error || 'Authentication required'});
        socket.disconnect(true);
        return;
      }
      // In development mode, userId will be null, which is allowed

      // Extract or generate correlation ID for this connection
      const correlationId = getOrCreateCorrelationId(socket.handshake.headers);

      // Store user ID and correlation ID on socket instance for later use
      // userId may be null in development mode
      const socketData: {userId?: string | null; correlationId?: string} = socket.data;
      socketData.userId = userId;
      socketData.correlationId = correlationId;

      logger.info(
        {socketId: socket.id, userId: userId || 'anonymous', correlationId},
        '[socket] Client connected'
      );

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
      socket.on('join_game', async (gid, ack) => {
        try {
          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in join_game');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }

          // Verify user is authorized to join this game
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;

          // In development mode, allow joining without authentication
          if (!socketUserId || !isValidUserId(socketUserId)) {
            if (config.auth.requireAuth) {
              logger.warn({socketId: socket.id, gid}, '[socket] Unauthorized join_game attempt');
              if (ack) void ack({error: 'Authentication required'});
              return;
            }
            // In dev mode, allow joining with null userId
            logger.debug(
              {socketId: socket.id, gid},
              '[socket] Joining game without authentication (dev mode)'
            );
            void socket.join(`game-${gid}`);
            if (ack) void ack({success: true});
            return;
          }

          const gameAuthResult = await this.checkGameAuthorization(gid, socketUserId);
          if (!gameAuthResult.authorized) {
            const errorMsg = gameAuthResult.reason === 'not_found' ? 'Game not found' : 'Access denied';
            logger.warn(
              {socketId: socket.id, gid, userId: socketUserId, reason: gameAuthResult.reason},
              '[socket] Access denied for game'
            );
            if (ack) void ack({error: errorMsg});
            return;
          }

          void socket.join(`game-${gid}`);
          logger.debug({gid, socketId: socket.id, userId: socketUserId}, '[socket] Client joined game');
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
          if (typeof gid !== 'string' || !gid.trim()) {
            logger.warn({gid}, '[socket] Invalid gid in sync_all_game_events');
            if (ack) void ack({error: 'Invalid game ID'});
            return;
          }

          // Verify user is authorized to access this game
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;
          if (!socketUserId || !isValidUserId(socketUserId)) {
            if (config.auth.requireAuth) {
              logger.warn({socketId: socket.id, gid}, '[socket] Unauthorized sync_all_game_events attempt');
              if (ack) void ack({error: 'Authentication required'});
              return;
            }
            // In dev mode, allow sync without authentication - skip authorization check
            logger.debug(
              {socketId: socket.id, gid},
              '[socket] Syncing game events without authentication (dev mode)'
            );
          } else {
            // Only check authorization if we have a userId
            const gameAuthResult = await this.checkGameAuthorization(gid, socketUserId);
            if (!gameAuthResult.authorized) {
              const errorMsg = gameAuthResult.reason === 'not_found' ? 'Game not found' : 'Access denied';
              logger.warn(
                {socketId: socket.id, gid, userId: socketUserId, reason: gameAuthResult.reason},
                '[socket] Access denied for game events'
              );
              if (ack) void ack({error: errorMsg});
              return;
            }
          }

          const {events} = await getGameEvents(this.db, gid);
          logger.debug({gid, eventCount: events.length}, '[socket] Syncing game events');
          if (ack) void ack(events);
        } catch (error) {
          logger.error({err: error, gid}, '[socket] Error syncing game events');
          if (ack) void ack({error: 'Failed to sync game events'});
        }
      });

      socket.on('sync_recent_game_events', async (data: {gid: string; limit?: number}, ack) => {
        try {
          if (typeof data !== 'object' || !data.gid) {
            if (ack) void ack({error: 'Invalid request'});
            return;
          }

          const {events, total} = await getGameEvents(this.db, data.gid, {limit: data.limit || 1000});
          logger.debug(
            {gid: data.gid, eventCount: events.length, total},
            '[socket] Syncing recent game events'
          );
          if (ack) void ack({events, total});
        } catch (error) {
          logger.error({err: error, gid: data.gid}, '[socket] Error syncing recent game events');
          if (ack) void ack({error: 'Failed to sync recent game events'});
        }
      });

      socket.on(
        'sync_archived_game_events',
        async (data: {gid: string; offset?: number; limit?: number}, ack) => {
          try {
            if (typeof data !== 'object' || !data.gid) {
              if (ack) void ack({error: 'Invalid request'});
              return;
            }

            // Calculate offset for archived events (events before the recent ones)
            const {total} = await getGameEvents(this.db, data.gid);
            const recentLimit = 1000;
            const archivedOffset = Math.max(0, total - recentLimit - (data.offset || 0));
            const archivedLimit = data.limit || 1000;

            const {events} = await getGameEvents(this.db, data.gid, {
              limit: archivedLimit,
              offset: archivedOffset,
            });

            logger.debug({gid: data.gid, eventCount: events.length}, '[socket] Syncing archived game events');
            if (ack) void ack(events);
          } catch (error) {
            logger.error({err: error, gid: data.gid}, '[socket] Error syncing archived game events');
            if (ack) void ack({error: 'Failed to sync archived game events'});
          }
        }
      );

      socket.on('game_event', async (message, ack) => {
        try {
          // Check rate limit first
          if (!checkRateLimit(socket)) {
            logger.warn({socketId: socket.id}, '[socket] Rate limit exceeded for game_event');
            if (ack) void ack({error: 'Rate limit exceeded. Please slow down.'});
            socket.disconnect(true);
            return;
          }

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

          // Get authenticated user ID from socket
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;
          if (!socketUserId || !isValidUserId(socketUserId)) {
            if (config.auth.requireAuth) {
              logger.warn({socketId: socket.id, gid}, '[socket] Unauthenticated game event attempt');
              if (ack) void ack({error: 'Authentication required'});
              return;
            }
            // In dev mode, allow events with null userId
            logger.debug(
              {socketId: socket.id, gid},
              '[socket] Processing game event without authentication (dev mode)'
            );
          }

          // Validate event using Zod schema
          const validation = validateGameEvent(event);
          if (!validation.valid) {
            logger.warn({gid, error: validation.error, event}, '[socket] Invalid game event');
            if (ack) void ack({error: validation.error});
            return;
          }

          // Ensure event has the authenticated user ID
          const validatedEvent = validation.validatedEvent;
          if (!validatedEvent) {
            socket.emit('game_error', {error: 'Invalid event payload'});
            return;
          }
          validatedEvent.user = socketUserId;

          await this.addGameEvent(gid, validatedEvent);
          logger.debug({gid, eventType: event.type, userId: socketUserId}, '[socket] Game event processed');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, message}, '[socket] Error handling game_event');
          if (ack) void ack({error: 'Failed to process game event'});
        }
      });

      // ======== Room Events ========= //

      socket.on('join_room', async (rid, ack) => {
        try {
          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in join_room');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }

          // Verify user is authorized to join this room
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;
          if (!socketUserId || !isValidUserId(socketUserId)) {
            if (config.auth.requireAuth) {
              logger.warn({socketId: socket.id, rid}, '[socket] Unauthorized join_room attempt');
              if (ack) void ack({error: 'Authentication required'});
              return;
            }
            // In dev mode, allow joining without authentication
            logger.debug(
              {socketId: socket.id, rid},
              '[socket] Joining room without authentication (dev mode)'
            );
            void socket.join(`room-${rid}`);
            if (ack) void ack({success: true});
            return;
          }

          const roomAuthResult = await this.checkRoomAuthorization(rid, socketUserId);
          if (!roomAuthResult.authorized) {
            const errorMsg = roomAuthResult.reason === 'not_found' ? 'Room not found' : 'Access denied';
            logger.warn(
              {socketId: socket.id, rid, userId: socketUserId, reason: roomAuthResult.reason},
              '[socket] Access denied for room'
            );
            if (ack) void ack({error: errorMsg});
            return;
          }

          void socket.join(`room-${rid}`);
          logger.debug({rid, socketId: socket.id, userId: socketUserId}, '[socket] Client joined room');
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
          if (typeof rid !== 'string' || !rid.trim()) {
            logger.warn({rid}, '[socket] Invalid rid in sync_all_room_events');
            if (ack) void ack({error: 'Invalid room ID'});
            return;
          }

          // Verify user is authorized to access this room
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;
          if (!socketUserId || !isValidUserId(socketUserId)) {
            logger.warn({socketId: socket.id, rid}, '[socket] Unauthorized sync_all_room_events attempt');
            if (ack) void ack({error: 'Authentication required'});
            return;
          }

          const roomAuthResult = await this.checkRoomAuthorization(rid, socketUserId);
          if (!roomAuthResult.authorized) {
            const errorMsg = roomAuthResult.reason === 'not_found' ? 'Room not found' : 'Access denied';
            logger.warn(
              {socketId: socket.id, rid, userId: socketUserId, reason: roomAuthResult.reason},
              '[socket] Access denied for room events'
            );
            if (ack) void ack({error: errorMsg});
            return;
          }

          const events = await getRoomEvents(this.db, rid);
          logger.debug({rid, eventCount: events.length}, '[socket] Syncing room events');
          if (ack) void ack(events);
        } catch (error) {
          logger.error({err: error, rid}, '[socket] Error syncing room events');
          if (ack) void ack({error: 'Failed to sync room events'});
        }
      });

      socket.on('room_event', async (message, ack) => {
        try {
          // Check rate limit first
          if (!checkRateLimit(socket)) {
            logger.warn({socketId: socket.id}, '[socket] Rate limit exceeded for room_event');
            if (ack) void ack({error: 'Rate limit exceeded. Please slow down.'});
            socket.disconnect(true);
            return;
          }

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

          // Get authenticated user ID from socket
          const socketUserId = isString(socket.data.userId) ? socket.data.userId : null;
          if (!socketUserId || !isValidUserId(socketUserId)) {
            logger.warn({socketId: socket.id, rid}, '[socket] Unauthenticated room event attempt');
            if (ack) void ack({error: 'Authentication required'});
            return;
          }

          // Validate event using Zod schema
          const validation = validateRoomEvent(event);
          if (!validation.valid) {
            logger.warn({rid, error: validation.error, event}, '[socket] Invalid room event');
            if (ack) void ack({error: validation.error});
            return;
          }

          // Ensure event has the authenticated user ID (if room events support uid field)
          const validatedEvent = validation.validatedEvent;
          if (!validatedEvent) {
            socket.emit('room_error', {error: 'Invalid event payload'});
            return;
          }
          if ('uid' in validatedEvent && validatedEvent.uid === undefined) {
            validatedEvent.uid = socketUserId;
          }

          await this.addRoomEvent(rid, validatedEvent);
          logger.debug({rid, eventType: event.type, userId: socketUserId}, '[socket] Room event processed');
          if (ack) void ack({success: true});
        } catch (error) {
          logger.error({err: error, message}, '[socket] Error handling room_event');
          if (ack) void ack({error: 'Failed to process room event'});
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info({socketId: socket.id, reason}, '[socket] Client disconnected');
        cleanupRateLimitState(socket.id);
      });

      socket.on('error', (error) => {
        logger.error({socketId: socket.id, err: error}, '[socket] Socket error');
      });
    });
  }
}

export default SocketManager;
