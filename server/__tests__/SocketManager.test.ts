import {pool, resetPoolMocks} from '../__mocks__/pool';

jest.mock('../model/pool', () => require('../__mocks__/pool'));
jest.mock('../auth/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

import SocketManager from '../SocketManager';
import {verifyAccessToken} from '../auth/jwt';

type AnyFn = (...args: unknown[]) => unknown;

// Minimal mock for socket.io Server and Socket
function createMockIo() {
  const emitFn = jest.fn();
  const toFn = jest.fn(() => ({emit: emitFn}));

  const socketHandlers: Record<string, AnyFn> = {};
  const mockSocket = {
    handshake: {auth: {}},
    data: {} as any,
    join: jest.fn(),
    leave: jest.fn(),
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

      expect(ack).not.toHaveBeenCalled();
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

      expect(ack).not.toHaveBeenCalled();
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
  });

  describe('room_event socket handler', () => {
    it('rejects events with missing event object', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const {io, socketHandlers} = createMockIo();
      const sm = new SocketManager(io);
      sm.listen();

      const ack = jest.fn();
      await socketHandlers['room_event']({rid: 'r1', event: undefined}, ack);

      expect(ack).not.toHaveBeenCalled();
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
  });
});
