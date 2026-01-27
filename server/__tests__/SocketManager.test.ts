import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import {Server as SocketIOServer} from 'socket.io';
import SocketManager from '../SocketManager.js';
import * as gameModel from '../model/game.js';
import * as roomModel from '../model/room.js';
import * as userAuth from '../utils/userAuth.js';

// Mock the models
vi.mock('../model/game.js');
vi.mock('../model/room.js');
vi.mock('../utils/userAuth.js');

describe('SocketManager', () => {
  let socketManager: SocketManager;
  let mockIo: SocketIOServer;
  let mockPool: {query: Mock; connect: Mock};
  let mockSocket: {
    join: Mock;
    leave: Mock;
    emit: Mock;
    on: Mock;
    to: Mock;
    disconnect: Mock;
    id: string;
    userId?: string;
    data: {userId?: string | null; correlationId?: string};
    handshake: {
      query: {userId?: string};
      auth: {userId?: string};
      headers: Record<string, string>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up userAuth mocks
    (userAuth.authenticateSocket as Mock).mockReturnValue({
      authenticated: true,
      userId: 'test-user-123',
    });
    (userAuth.isValidUserId as Mock).mockReturnValue(true);
    (userAuth.isUserAuthorizedForGame as Mock).mockResolvedValue({authorized: true, reason: 'participant'});
    (userAuth.isUserAuthorizedForRoom as Mock).mockResolvedValue({authorized: true, reason: 'participant'});

    mockSocket = {
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      id: 'mock-socket-id',
      data: {},
      handshake: {
        query: {userId: 'test-user-123'},
        auth: {},
        headers: {},
      },
    };

    mockIo = {
      on: vi.fn((event, callback) => {
        if (event === 'connection') {
          // Simulate connection by calling callback with mock socket
          setTimeout(() => callback(mockSocket), 0);
        }
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer;

    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };

    socketManager = new SocketManager(mockIo, mockPool);
  });

  describe('constructor', () => {
    it('should create SocketManager with io instance', () => {
      expect(socketManager.io).toBe(mockIo);
    });
  });

  describe('addGameEvent', () => {
    it('should add game event and emit to room', async () => {
      const mockGid = 'test-gid-123';
      const mockEvent = {
        timestamp: 1234567890,
        type: 'updateCell',
        params: {
          cell: {r: 0, c: 1},
          value: 'A',
          autocheck: false,
          id: 'user123',
        },
      };

      (gameModel.addGameEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      await socketManager.addGameEvent(mockGid, mockEvent);

      expect(gameModel.addGameEvent).toHaveBeenCalledWith(
        mockPool,
        mockGid,
        expect.objectContaining({type: 'updateCell'})
      );
      expect(mockIo.to).toHaveBeenCalledWith(`game-${mockGid}`);
      expect(mockIo.emit).toHaveBeenCalledWith('game_event', {
        gid: mockGid,
        event: expect.objectContaining({type: 'updateCell'}),
      });
    });

    it('should assign timestamp for Firebase-style server timestamp', async () => {
      const mockGid = 'test-gid-123';
      const mockEvent = {
        '.sv': 'timestamp',
        type: 'updateCell',
        params: {
          cell: {r: 0, c: 1},
          value: 'A',
          autocheck: false,
          id: 'user123',
        },
      };

      (gameModel.addGameEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      await socketManager.addGameEvent(mockGid, mockEvent);

      const callArgs = (gameModel.addGameEvent as Mock).mock.calls[0][2];
      expect(typeof callArgs.timestamp).toBe('number');
      expect(callArgs.timestamp).toBeGreaterThan(0);
    });

    it('should handle nested Firebase timestamps', async () => {
      const mockGid = 'test-gid-123';
      const mockEvent = {
        timestamp: {'.sv': 'timestamp'},
        type: 'updateCell',
        params: {
          cell: {r: 0, c: 1},
          value: 'A',
          autocheck: false,
          id: 'user123',
        },
      };

      (gameModel.addGameEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      await socketManager.addGameEvent(mockGid, mockEvent);

      const callArgs = (gameModel.addGameEvent as Mock).mock.calls[0][2];
      expect(typeof callArgs.timestamp).toBe('number');
    });

    it('should validate and fix invalid timestamps', async () => {
      const mockGid = 'test-gid-123';
      const mockEvent = {
        timestamp: NaN,
        type: 'updateCell',
        params: {
          cell: {r: 0, c: 1},
          value: 'A',
          autocheck: false,
          id: 'user123',
        },
      };

      (gameModel.addGameEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      await socketManager.addGameEvent(mockGid, mockEvent);

      const callArgs = (gameModel.addGameEvent as Mock).mock.calls[0][2];
      expect(typeof callArgs.timestamp).toBe('number');
      expect(callArgs.timestamp).toBeGreaterThan(0);
    });
  });

  describe('addRoomEvent', () => {
    it('should add room event and emit to room', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: 1234567890,
        type: 'SET_GAME',
        params: {gid: 'game-123'},
        uid: 'user123',
      };

      (roomModel.addRoomEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      await socketManager.addRoomEvent(mockRid, mockEvent);

      expect(roomModel.addRoomEvent).toHaveBeenCalledWith(
        mockPool,
        mockRid,
        expect.objectContaining({type: 'SET_GAME'})
      );
      expect(mockIo.to).toHaveBeenCalledWith(`room-${mockRid}`);
      expect(mockIo.emit).toHaveBeenCalledWith('room_event', expect.objectContaining({type: 'SET_GAME'}));
    });
  });

  describe('socket event handlers', () => {
    beforeEach(() => {
      // Reset mockSocket.on to track new calls
      mockSocket.on = vi.fn();
      // Set up the connection handler to actually call the callback with mockSocket synchronously
      (mockIo.on as Mock).mockImplementation((event, callback) => {
        if (event === 'connection') {
          // Immediately call the callback with mockSocket to register handlers
          callback(mockSocket);
        }
      });
      socketManager.listen();
    });

    it('should handle latency_ping', () => {
      const clientTimestamp = Date.now() - 100;
      const pingHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'latency_ping')?.[1];

      expect(pingHandler).toBeDefined();
      if (pingHandler) {
        pingHandler(clientTimestamp);
        // Check that pong was emitted
        expect(mockSocket.emit).toHaveBeenCalledWith('latency_pong', expect.any(Number));
      }
    });

    it('should handle invalid latency_ping timestamp', () => {
      const pingHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'latency_ping')?.[1];

      if (pingHandler) {
        pingHandler(NaN);
        // Should not emit pong for invalid timestamp
        expect(mockSocket.emit).not.toHaveBeenCalledWith('latency_pong', expect.any(Number));
      }
    });

    it('should handle join_game', async () => {
      const gid = 'test-gid-123';
      const ack = vi.fn();
      const joinHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'join_game')?.[1];

      expect(joinHandler).toBeDefined();
      if (joinHandler) {
        await joinHandler(gid, ack);
        expect(mockSocket.join).toHaveBeenCalledWith(`game-${gid}`);
        expect(ack).toHaveBeenCalled();
      }
    });

    it('should handle leave_game', () => {
      const gid = 'test-gid-123';
      const ack = vi.fn();
      const leaveHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'leave_game')?.[1];

      expect(leaveHandler).toBeDefined();
      if (leaveHandler) {
        leaveHandler(gid, ack);
        expect(mockSocket.leave).toHaveBeenCalledWith(`game-${gid}`);
        expect(ack).toHaveBeenCalled();
      }
    });

    it('should handle sync_all_game_events', async () => {
      const gid = 'test-gid-123';
      const mockEvents = [
        {type: 'create', timestamp: 1000},
        {type: 'updateCell', timestamp: 2000},
      ];
      const ack = vi.fn();

      (gameModel.getGameEvents as Mock).mockResolvedValue({events: mockEvents, total: 2});

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_all_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(gid, ack);
        expect(gameModel.getGameEvents).toHaveBeenCalledWith(mockPool, gid);
        expect(ack).toHaveBeenCalledWith(mockEvents);
      }
    });

    it('should handle sync_recent_game_events', async () => {
      const data = {gid: 'test-gid-123', limit: 100};
      const mockEvents = [
        {type: 'create', timestamp: 1000},
        {type: 'updateCell', timestamp: 2000},
      ];
      const ack = vi.fn();

      (gameModel.getGameEvents as Mock).mockResolvedValue({events: mockEvents, total: 5});

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_recent_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(gameModel.getGameEvents).toHaveBeenCalledWith(mockPool, data.gid, {limit: 100});
        expect(ack).toHaveBeenCalledWith({events: mockEvents, total: 5});
      }
    });

    it('should handle sync_recent_game_events with default limit', async () => {
      const data = {gid: 'test-gid-123'};
      const mockEvents = [{type: 'create', timestamp: 1000}];
      const ack = vi.fn();

      (gameModel.getGameEvents as Mock).mockResolvedValue({events: mockEvents, total: 1});

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_recent_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(gameModel.getGameEvents).toHaveBeenCalledWith(mockPool, data.gid, {limit: 1000});
        expect(ack).toHaveBeenCalledWith({events: mockEvents, total: 1});
      }
    });

    it('should handle sync_recent_game_events with invalid request', async () => {
      const data = {};
      const ack = vi.fn();

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_recent_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(ack).toHaveBeenCalledWith({error: 'Invalid request'});
        expect(gameModel.getGameEvents).not.toHaveBeenCalled();
      }
    });

    it('should handle sync_archived_game_events', async () => {
      const data = {gid: 'test-gid-123', offset: 0, limit: 50};
      const mockEvents = [{type: 'updateCell', timestamp: 2000}];
      const ack = vi.fn();

      (gameModel.getGameEvents as Mock)
        .mockResolvedValueOnce({events: [], total: 1050}) // First call to get total
        .mockResolvedValueOnce({events: mockEvents, total: 1050}); // Second call with pagination

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_archived_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(gameModel.getGameEvents).toHaveBeenCalledTimes(2);
        expect(gameModel.getGameEvents).toHaveBeenNthCalledWith(1, mockPool, data.gid);
        // archivedOffset = Math.max(0, 1050 - 1000 - 0) = 50
        expect(gameModel.getGameEvents).toHaveBeenNthCalledWith(2, mockPool, data.gid, {
          limit: 50,
          offset: 50,
        });
        expect(ack).toHaveBeenCalledWith(mockEvents);
      }
    });

    it('should handle sync_archived_game_events with default values', async () => {
      const data = {gid: 'test-gid-123'};
      const mockEvents = [{type: 'updateCell', timestamp: 2000}];
      const ack = vi.fn();

      (gameModel.getGameEvents as Mock)
        .mockResolvedValueOnce({events: [], total: 2000}) // First call to get total
        .mockResolvedValueOnce({events: mockEvents, total: 2000}); // Second call with pagination

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_archived_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(gameModel.getGameEvents).toHaveBeenCalledTimes(2);
        expect(gameModel.getGameEvents).toHaveBeenNthCalledWith(1, mockPool, data.gid);
        // archivedOffset = Math.max(0, 2000 - 1000 - 0) = 1000
        expect(gameModel.getGameEvents).toHaveBeenNthCalledWith(2, mockPool, data.gid, {
          limit: 1000,
          offset: 1000,
        });
        expect(ack).toHaveBeenCalledWith(mockEvents);
      }
    });

    it('should handle sync_archived_game_events with invalid request', async () => {
      const data = {};
      const ack = vi.fn();

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_archived_game_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(data, ack);
        expect(ack).toHaveBeenCalledWith({error: 'Invalid request'});
        expect(gameModel.getGameEvents).not.toHaveBeenCalled();
      }
    });

    it('should handle game_event', async () => {
      const message = {
        gid: 'test-gid-123',
        event: {
          timestamp: 1234567890,
          type: 'updateCell',
          params: {cell: {r: 0, c: 1}, value: 'A', autocheck: false, id: 'user123'},
        },
      };
      const ack = vi.fn();

      (gameModel.addGameEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      const gameEventHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'game_event'
      )?.[1];

      if (gameEventHandler) {
        await gameEventHandler(message, ack);
        expect(gameModel.addGameEvent).toHaveBeenCalledWith(mockPool, message.gid, expect.any(Object));
        expect(ack).toHaveBeenCalled();
      }
    });

    it('should handle join_room', async () => {
      const rid = 'test-room-123';
      const ack = vi.fn();
      const joinHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'join_room')?.[1];

      expect(joinHandler).toBeDefined();
      if (joinHandler) {
        await joinHandler(rid, ack);
        expect(mockSocket.join).toHaveBeenCalledWith(`room-${rid}`);
        expect(ack).toHaveBeenCalled();
      }
    });

    it('should handle leave_room', () => {
      const rid = 'test-room-123';
      const ack = vi.fn();
      const leaveHandler = (mockSocket.on as Mock).mock.calls.find((call) => call[0] === 'leave_room')?.[1];

      expect(leaveHandler).toBeDefined();
      if (leaveHandler) {
        leaveHandler(rid, ack);
        expect(mockSocket.leave).toHaveBeenCalledWith(`room-${rid}`);
        expect(ack).toHaveBeenCalled();
      }
    });

    it('should handle sync_all_room_events', async () => {
      const rid = 'test-room-123';
      const mockEvents = [{type: 'USER_PING', timestamp: 1000, uid: 'user1', params: {uid: 'user1'}}];
      const ack = vi.fn();

      (roomModel.getRoomEvents as Mock).mockResolvedValue(mockEvents);

      const syncHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'sync_all_room_events'
      )?.[1];

      if (syncHandler) {
        await syncHandler(rid, ack);
        expect(roomModel.getRoomEvents).toHaveBeenCalledWith(mockPool, rid);
        expect(ack).toHaveBeenCalledWith(mockEvents);
      }
    });

    it('should handle room_event', async () => {
      const message = {
        rid: 'test-room-123',
        event: {
          timestamp: 1234567890,
          type: 'SET_GAME',
          params: {gid: 'game-123'},
          uid: 'user123',
        },
      };
      const ack = vi.fn();

      (roomModel.addRoomEvent as Mock).mockResolvedValue(undefined);
      (mockIo.to as Mock).mockReturnThis();
      (mockIo.emit as Mock).mockReturnThis();

      const roomEventHandler = (mockSocket.on as Mock).mock.calls.find(
        (call) => call[0] === 'room_event'
      )?.[1];

      if (roomEventHandler) {
        await roomEventHandler(message, ack);
        expect(roomModel.addRoomEvent).toHaveBeenCalledWith(mockPool, message.rid, expect.any(Object));
        expect(ack).toHaveBeenCalled();
      }
    });
  });
});
