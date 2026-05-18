// ============= Server Values ===========

import {RoomEvent} from '@shared/roomEvents';
import * as Sentry from '@sentry/node';
import {Server} from 'socket.io';
import {addGameEvent, gameExists, GameEvent, getGameEvents} from './model/game';
import {addRoomEvent, getRoomEvents} from './model/room';
import {verifyAccessToken} from './auth/jwt';
import {
  getGameOwner,
  isActionRestricted,
  isGameLocked,
  isIdentityBanned,
  isOwner,
  RestrictableAction,
  wasParticipantOfGame,
} from './model/game_moderation';
import {getDfacIdsForUser} from './model/user';

// Event types that are broadcast to connected clients but NOT persisted to the database.
// updateCursor and addPing are high-frequency and only meaningful in real-time.
// updateDisplayName and updateColor are persisted so players remain visible on reload.
const EPHEMERAL_EVENT_TYPES = new Set(['updateCursor', 'addPing']);

// Event types that the owner can restrict to themselves via /api/game/:gid/restrictions/:action.
// Null-prototype object so external-input lookups (event.type from the
// socket payload) can't pick up inherited Object.prototype members like
// `toString` and return a truthy non-action value.
const RESTRICTABLE_EVENT_TYPES: Record<string, RestrictableAction> = Object.assign(Object.create(null), {
  check: 'check',
  reveal: 'reveal',
  reset: 'reset',
});

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
    // Auth middleware: verify JWT on connection if provided (guests still
    // allowed). Also captures the client's dfac_id from the handshake so we
    // can ban/lock-check both identities later.
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
          socket.data.authUser = payload;
        }
      }
      const dfacId = socket.handshake.auth?.dfacId;
      if (typeof dfacId === 'string' && dfacId) {
        socket.data.dfacId = dfacId;
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
          // Moderation gates: identity-based ban first, then lock (with an
          // owner bypass so the owner can always rejoin even on a locked
          // game). Both reads are cached per-gid; misses are still fast PK
          // lookups.
          // We intentionally don't require an identity on the handshake:
          // dfacId-in-handshake shipped in this PR, so stale tabs from
          // before would be locked out of every game otherwise. Bans for
          // unauthed guests are best-effort regardless — a guest can clear
          // localStorage and reappear under a fresh dfacId either way.
          // For authed targets we additionally ban the linked user_id in
          // /kick, which is the layer that's actually robust.
          const identity = {
            userId: socket.data.authUser?.userId,
            dfacId: socket.data.dfacId,
          };
          if (await isIdentityBanned(gid, identity)) {
            if (typeof ack === 'function') ack({error: 'banned'});
            return;
          }
          if (await isGameLocked(gid)) {
            // Owner bypass only trusts the authenticated identity: the dfac
            // id from the socket handshake is client-supplied and the owner's
            // dfac id is visible to every player via the create event and
            // /moderation.owner. Trusting it here would let any client spoof
            // ownership and walk past the lock. lock/unlock require auth, so
            // every lockable game has an authenticated owner — the linked
            // dfac ids from the token are sufficient.
            const owner = await getGameOwner(gid);
            const dfacIds = identity.userId ? await getDfacIdsForUser(identity.userId) : [];
            const isCallerOwner = isOwner(owner, {userId: identity.userId, dfacIds});
            if (!isCallerOwner) {
              // Prior participants get through too — the lock contract is
              // "block new joins, existing players keep playing". Without
              // this, a transient socket reconnect would re-issue join_game
              // and the client treats the {error: 'locked'} as terminal,
              // effectively ejecting everyone on flaky networks (and any
              // page refresh).
              const wasParticipant = await wasParticipantOfGame(gid, identity);
              if (!wasParticipant) {
                if (typeof ack === 'function') ack({error: 'locked'});
                return;
              }
            }
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
          // Require room membership so banned/locked clients can't read
          // game history by calling this directly after a rejected
          // join_game.
          if (!socket.rooms.has(`game-${gid}`)) {
            if (typeof ack === 'function') ack({error: 'not in game'});
            return;
          }
          // Re-check ban on every read: room membership alone isn't enough
          // because kicks happen after join_game (the socket is already in
          // the room) and a malicious/modified client can ignore the
          // 'kicked' broadcast and keep calling this to read history.
          // The /kick handler also evicts the socket from the room
          // server-side, but this gate is the durable one.
          if (
            await isIdentityBanned(gid, {
              userId: socket.data.authUser?.userId,
              dfacId: socket.data.dfacId,
            })
          ) {
            if (typeof ack === 'function') ack({error: 'banned'});
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
          // create events are HTTP-only. Allowing them over the socket lets
          // any authed player emit a backdated create with their own
          // params.creator, which getGameOwner (ORDER BY ts ASC LIMIT 1)
          // would then return — turning every moderation endpoint into a
          // privilege-escalation path. Real bootstrapping happens in
          // /api/game POST → addInitialGameEvent with server-stamped ts.
          if (event.type === 'create') {
            if (typeof ack === 'function') ack({error: 'create not allowed over socket'});
            return;
          }
          // Banned identities can't send events of any kind. Includes
          // ephemeral cursor/ping — a kicked user shouldn't keep showing up
          // in the live presence view.
          if (
            await isIdentityBanned(message.gid, {
              userId: socket.data.authUser?.userId,
              dfacId: socket.data.dfacId,
            })
          ) {
            if (typeof ack === 'function') ack({error: 'banned'});
            return;
          }
          // Require that the socket actually joined the room. Join is gated
          // by isGameLocked + isIdentityBanned in join_game above, so this
          // is what makes lock cover writes too: a new client that never
          // joined can't smuggle in updateCell/chat directly. Existing
          // players who joined before the lock keep their seat.
          if (!socket.rooms.has(`game-${message.gid}`)) {
            if (typeof ack === 'function') ack({error: 'not in game'});
            return;
          }
          // Per-action restrictions: owner can mark check/reveal/reset as
          // owner-only. isActionRestricted is cache-hit fast path; we only
          // resolve the caller's owner status (which itself hits user_identity_map
          // for linked dfac ids) when a restriction actually exists. Mirrors
          // the lock-bypass logic in join_game — we only trust the
          // authenticated identity for owner status, not the handshake's
          // client-supplied dfacId.
          const restrictableAction = RESTRICTABLE_EVENT_TYPES[event.type];
          if (restrictableAction && (await isActionRestricted(message.gid, restrictableAction))) {
            const owner = await getGameOwner(message.gid);
            const callerUserId = socket.data.authUser?.userId;
            const dfacIds = callerUserId ? await getDfacIdsForUser(callerUserId) : [];
            if (!isOwner(owner, {userId: callerUserId, dfacIds})) {
              if (typeof ack === 'function') ack({error: 'restricted'});
              return;
            }
          }
          // Reject persisted events for gids that don't have a create event
          // or snapshot — prevents orphan rows from accumulating for legacy
          // gids whose game was never bootstrapped server-side (#478).
          // Ephemeral events (cursor, ping) bypass since they aren't
          // persisted. Cache positive results per socket to avoid repeated
          // DB lookups.
          if (!EPHEMERAL_EVENT_TYPES.has(event.type)) {
            const verified: Set<string> = (socket.data.verifiedGids ||= new Set());
            if (!verified.has(message.gid)) {
              if (await gameExists(message.gid)) {
                verified.add(message.gid);
              } else {
                if (typeof ack === 'function') ack({error: 'unknown game'});
                return;
              }
            }
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
