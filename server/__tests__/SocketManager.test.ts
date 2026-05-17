import {pool, resetPoolMocks} from '../__mocks__/pool';

jest.mock('../model/pool', () => require('../__mocks__/pool'));
jest.mock('../auth/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));
jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

import SocketManager from '../SocketManager';
import {verifyAccessToken} from '../auth/jwt';
import * as Sentry from '@sentry/node';

type AnyFn = (...args: unknown[]) => unknown;

// Minimal mock for socket.io Server and Socket
function createMockIo() {
  const emitFn = jest.fn();
  const toFn = jest.fn(() => ({emit: emitFn}));

  const socketHandlers: Record<string, AnyFn> = {};
  // Pre-populate `rooms` with the default test gid so handler tests that
  // invoke game_event directly (without going through join_game) don't
  // trip the production room-membership check. Tests that want to verify
  // the rejection path can clear the set or use a different gid.
  const rooms = new Set<string>(['game-g1']);
  const mockSocket = {
    handshake: {auth: {}},
    data: {} as any,
    rooms,
    join: jest.fn((room: string) => rooms.add(room)),
    leave: jest.fn((room: string) => rooms.delete(room)),
    on: jest.fn((event: string, handler: AnyFn) => {
      socketHandlers[event] = handler;
    }),
  };

  const middlewares: AnyFn[] = [];
  const io = {
    to: toFn,
    use: jest.fn((fn: AnyFn) => middlewares.push(fn)),
    on: jest.fn((event: string, handler: AnyFn) => {
      if (event === 'connection') {
        // Run middleware first, then connection handler
        const next = jest.fn();
        for (const mw of middlewares) {
          mw(mockSocket, next);
        }
        handler(mockSocket);
      }
    }),
  } as any;

  return {io, mockSocket, socketHandlers, emitFn, toFn};
}

describe('SocketManager', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
    (verifyAccessToken as jest.Mock).mockReset();
    (Sentry.captureException as jest.Mock).mockClear();
  });

  describe('addGameEvent', () => {
    it('persists non-ephemeral events to the database', async () => {
      const {io, emitFn, toFn} = createMockIo();
      const sm = new SocketManager(io);

      await sm.addGameEvent('g1', {
        timestamp: 1700000000000,
        type: 'updateCell',
        params: {id: 'p1'},
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(toFn).toHaveBeenCalledWith('game-g1');
      expect(emitFn).toHaveBeenCalledWith('game_event', expect.objectContaining({type: 'updateCell'}));
    });

    it('skips persistence for ephemeral events (updateCursor)', async () => {
      const {io, emitFn} = createMockIo();
      const sm = new SocketManager(io);

      await sm.addGameEvent('g1', {
        timestamp: 1700000000000,
        type: 'updateCursor',
        params: {id: 'p1'},
      });

      expect(pool.query).not.toHaveBeenCalled();
      expect(emitFn).toHaveBeenCalledWith('game_event', expect.objectContaining({type: 'updateCursor'}));
    });

    it('skips persistence for ephemeral events (addPing)', async () => {
      const {io} = createMockIo();
      const sm = new SocketManager(io);

      await sm.addGameEvent('g1', {
        timestamp: 1700000000000,
        type: 'addPing',
        params: {},
      });

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('game_event socket handler', () => {
    it('rejects events with missing event object', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['game_event']({gid: 'g1', event: null}, ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid event'});
      expect(pool.query).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('rejects events with non-string type', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['game_event']({gid: 'g1', event: {type: 123, timestamp: 1000}}, ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid event'});
      expect(pool.query).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('rejects events with missing gid', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['game_event'](
        {gid: undefined, event: {type: 'updateCell', timestamp: 1000, params: {}}},
        ack
      );

      expect(ack).toHaveBeenCalledWith({error: 'invalid gid'});
      expect(pool.query).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('replaces non-numeric timestamps with Date.now()', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const now = Date.now();
      const ack = jest.fn();
      const event = {type: 'updateCursor', timestamp: {'.sv': 'timestamp'}, params: {}};
      await socketHandlers['game_event']({gid: 'g1', event}, ack);

      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThanOrEqual(now);
      expect(ack).toHaveBeenCalled();
    });

    it('preserves valid numeric timestamps', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      const event = {type: 'updateCursor', timestamp: 1700000000000, params: {}};
      await socketHandlers['game_event']({gid: 'g1', event}, ack);

      expect(event.timestamp).toBe(1700000000000);
      expect(ack).toHaveBeenCalled();
    });

    it('stamps verifiedUserId when socket is authenticated', async () => {
      (verifyAccessToken as jest.Mock).mockReturnValue({userId: 'user-42'});
      const {io, socketHandlers, mockSocket} = createMockIo();
      mockSocket.handshake.auth = {token: 'valid-token'};

      const sm = new SocketManager(io);
      sm.listen();

      // isIdentityBanned reads moderation state (bans + locks + create event
      // for owner caching) on first contact with this gid.
      pool.query.mockResolvedValueOnce({rows: []});
      pool.query.mockResolvedValueOnce({rows: []});
      pool.query.mockResolvedValueOnce({rows: []});
      // gameExists check — game has a create event
      pool.query.mockResolvedValueOnce({rowCount: 1, rows: [{}]});
      const ack = jest.fn();
      const event = {type: 'updateCell', timestamp: 1700000000000, params: {id: 'p1'}} as any;
      await socketHandlers['game_event']({gid: 'g1', event}, ack);

      expect(event.verifiedUserId).toBe('user-42');
      expect(ack).toHaveBeenCalled();
    });

    it('does not stamp verifiedUserId for unauthenticated sockets', async () => {
      (verifyAccessToken as jest.Mock).mockReturnValue(null);
      const {io, socketHandlers} = createMockIo();

      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      const event = {type: 'updateCell', timestamp: 1700000000000, params: {id: 'p1'}} as any;
      await socketHandlers['game_event']({gid: 'g1', event}, ack);

      expect(event.verifiedUserId).toBeUndefined();
      expect(ack).toHaveBeenCalled();
    });

    it('catches DB errors and reports to Sentry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const dbError = new Error('connection refused');
      pool.query.mockRejectedValueOnce(dbError);

      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['game_event'](
        {gid: 'g1', event: {type: 'updateCell', timestamp: 1700000000000, params: {}}},
        ack
      );

      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
      expect(ack).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('strips verifiedUserId from unauthenticated events', async () => {
      (verifyAccessToken as jest.Mock).mockReturnValue(null);
      const {io, socketHandlers} = createMockIo();

      const sm = new SocketManager(io);
      sm.listen();

      // gameExists check — game has a create event
      pool.query.mockResolvedValueOnce({rowCount: 1, rows: [{}]});
      const ack = jest.fn();
      const event = {
        type: 'updateCell',
        timestamp: 1700000000000,
        params: {id: 'p1'},
        verifiedUserId: 'spoofed',
      } as any;
      await socketHandlers['game_event']({gid: 'g1', event}, ack);

      expect(event.verifiedUserId).toBeUndefined();
      expect(ack).toHaveBeenCalled();
    });

    it('does not crash when ack is not provided', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      // Should not throw even without ack callback
      await expect(
        socketHandlers['game_event']({gid: 'g1', event: {type: 'updateCursor', timestamp: 1000, params: {}}})
      ).resolves.not.toThrow();
    });

    it('rejects persisted events for gids without a create event or snapshot', async () => {
      const {io, socketHandlers, mockSocket} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();
      // Pretend the socket joined this gid already so we exercise the
      // gameExists gate rather than the upstream room-membership check.
      mockSocket.rooms.add('game-orphan-gid');

      // gameExists: no create event, then no snapshot
      pool.query.mockResolvedValueOnce({rowCount: 0, rows: []}); // create event lookup
      pool.query.mockResolvedValueOnce({rows: []}); // getGameSnapshot

      const ack = jest.fn();
      const event = {type: 'updateCell', timestamp: 1700000000000, params: {id: 'p1'}};
      await socketHandlers['game_event']({gid: 'orphan-gid', event}, ack);

      expect(ack).toHaveBeenCalledWith({error: 'unknown game'});
      // Only the two gameExists lookups should have run — no INSERT
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('caches gameExists result per socket', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      // First event: gameExists hits DB and finds create event
      pool.query.mockResolvedValueOnce({rowCount: 1, rows: [{}]});
      const ack1 = jest.fn();
      await socketHandlers['game_event'](
        {gid: 'g1', event: {type: 'updateCell', timestamp: 1700000000000, params: {id: 'p1'}}},
        ack1
      );
      expect(ack1).toHaveBeenCalledWith();

      // Second event for the same gid should NOT call gameExists again — only INSERT
      pool.query.mockClear();
      const ack2 = jest.fn();
      await socketHandlers['game_event'](
        {gid: 'g1', event: {type: 'updateCell', timestamp: 1700000000001, params: {id: 'p1'}}},
        ack2
      );
      expect(ack2).toHaveBeenCalledWith();
      // Only one query should have run (the INSERT) — the gameExists check was cached
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('rejects create events over the socket (HTTP-only bootstrap)', async () => {
      // Allowing socket-side creates lets any authed player emit a backdated
      // create with their own params.creator. getGameOwner reads earliest by
      // ts → the impostor's row → privilege escalation through /kick, /lock,
      // /unlock. Real bootstrap happens via /api/game POST.
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['game_event'](
        {
          gid: 'g1',
          event: {
            type: 'create',
            timestamp: 1, // backdated to win the ORDER BY ts ASC race
            params: {pid: 'p1', creator: {dfacId: 'attacker'}},
          },
        },
        ack
      );

      expect(ack).toHaveBeenCalledWith({error: 'create not allowed over socket'});
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('allows ephemeral events to bypass the gate', async () => {
      const {io, socketHandlers, mockSocket} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();
      // Ephemeral cursor/ping still require the socket to be in the room.
      // The "gate" this test is about is the gameExists check, not the
      // room-membership one — pretend we joined already.
      mockSocket.rooms.add('game-orphan-gid');

      const ack = jest.fn();
      await socketHandlers['game_event'](
        {gid: 'orphan-gid', event: {type: 'updateCursor', timestamp: 1000, params: {}}},
        ack
      );

      expect(ack).toHaveBeenCalledWith();
      // No DB query should have run for an ephemeral event
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects non-create events from sockets that never joined the room', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();
      // No mockSocket.rooms.add — the new gid was never joined. Without
      // this gate, a client could skip join_game (which is what enforces
      // bans + locks) and still emit updateCell/chat directly.

      const ack = jest.fn();
      await socketHandlers['game_event'](
        {gid: 'unjoined-gid', event: {type: 'updateCell', timestamp: 1000, params: {id: 'p1'}}},
        ack
      );
      expect(ack).toHaveBeenCalledWith({error: 'not in game'});
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('sync_all_game_events handler', () => {
    it('returns events on success', async () => {
      const eventPayload = {type: 'updateCell', timestamp: 1000, params: {}};
      // getGameEvents checks for snapshot first (returns null), then loads all events
      pool.query.mockResolvedValueOnce({rows: []}); // getGameSnapshot → no snapshot
      pool.query.mockResolvedValueOnce({rows: [{event_payload: eventPayload}]});

      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['sync_all_game_events']('g1', ack);

      expect(ack).toHaveBeenCalledWith([eventPayload]);
    });

    it('rejects invalid gid', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['sync_all_game_events']('', ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid gid'});
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects history sync from sockets that never joined the room', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();
      // Without the room-membership gate, a client rejected by join_game
      // (banned/locked) could still call this directly and read game/chat
      // history. Use a gid that isn't in the pre-populated room set.

      const ack = jest.fn();
      await socketHandlers['sync_all_game_events']('unjoined-gid', ack);

      expect(ack).toHaveBeenCalledWith({error: 'not in game'});
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('catches DB errors and reports to Sentry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const dbError = new Error('query timeout');
      pool.query.mockRejectedValueOnce(dbError);

      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['sync_all_game_events']('g1', ack);

      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
      expect(ack).toHaveBeenCalledWith([]);
      consoleSpy.mockRestore();
    });
  });

  describe('join_game / leave_game handlers', () => {
    it('rejects invalid gid for join_game', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['join_game'](undefined, ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid gid'});
    });

    it('rejects invalid gid for leave_game', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['leave_game']('', ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid gid'});
    });
  });

  describe('room_event socket handler', () => {
    it('rejects events with missing event object', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['room_event']({rid: 'r1', event: undefined}, ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid event'});
      expect(pool.query).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('rejects events with missing rid', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['room_event'](
        {rid: undefined, event: {type: 'chat', timestamp: 1000, uid: 'u1'}},
        ack
      );

      expect(ack).toHaveBeenCalledWith({error: 'invalid rid'});
      expect(pool.query).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('replaces non-numeric timestamps with Date.now()', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const now = Date.now();
      const ack = jest.fn();
      const event = {type: 'chat', timestamp: 'not-a-number' as any, uid: 'u1'};
      await socketHandlers['room_event']({rid: 'r1', event}, ack);

      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThanOrEqual(now);
      expect(ack).toHaveBeenCalled();
    });

    it('persists valid room events', async () => {
      const {io, socketHandlers, toFn} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['room_event'](
        {rid: 'r1', event: {type: 'chat', timestamp: 1700000000000, uid: 'u1'}},
        ack
      );

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(toFn).toHaveBeenCalledWith('room-r1');
    });

    it('catches DB errors and reports to Sentry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const dbError = new Error('connection lost');
      pool.query.mockRejectedValueOnce(dbError);

      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['room_event'](
        {rid: 'r1', event: {type: 'chat', timestamp: 1700000000000, uid: 'u1'}},
        ack
      );

      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
      expect(ack).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('sync_all_room_events handler', () => {
    it('rejects invalid rid', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['sync_all_room_events']('', ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid rid'});
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('catches DB errors and reports to Sentry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const dbError = new Error('query timeout');
      pool.query.mockRejectedValueOnce(dbError);

      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['sync_all_room_events']('r1', ack);

      expect(Sentry.captureException).toHaveBeenCalledWith(dbError);
      expect(ack).toHaveBeenCalledWith([]);
      consoleSpy.mockRestore();
    });
  });

  describe('join_room / leave_room handlers', () => {
    it('rejects invalid rid for join_room', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['join_room'](null, ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid rid'});
    });

    it('rejects invalid rid for leave_room', async () => {
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['leave_room']('', ack);

      expect(ack).toHaveBeenCalledWith({error: 'invalid rid'});
    });
  });
});
