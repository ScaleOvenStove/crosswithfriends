import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import {RoomEventType} from '@shared/roomEvents';
import * as roomModel from '../../model/room.js';
import {pool} from '../../model/pool.js';

// Mock the database pool
vi.mock('../../model/pool.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Room Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoomEvents', () => {
    it('should retrieve room events from database', async () => {
      const mockRid = 'test-room-123';
      const mockEvents = [
        {type: RoomEventType.USER_PING, timestamp: 1000, uid: 'user1', params: {uid: 'user1'}},
        {type: RoomEventType.SET_GAME, timestamp: 2000, uid: 'user1', params: {gid: 'game1'}},
      ];

      (pool.query as Mock).mockResolvedValue({
        rows: mockEvents.map((event) => ({event_payload: event})),
      });

      const events = await roomModel.getRoomEvents(mockRid);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT event_payload FROM room_events WHERE rid=$1 ORDER BY ts ASC',
        [mockRid]
      );
      expect(events).toEqual(mockEvents);
    });

    it('should return empty array when no events exist', async () => {
      const mockRid = 'test-room-123';
      (pool.query as Mock).mockResolvedValue({rows: []});

      const events = await roomModel.getRoomEvents(mockRid);
      expect(events).toEqual([]);
    });

    it('should handle multiple events', async () => {
      const mockRid = 'test-room-123';
      const mockEvents = Array(10)
        .fill(null)
        .map((_, i) => ({
          type: RoomEventType.USER_PING,
          timestamp: 1000 + i,
          uid: `user${i}`,
          params: {uid: `user${i}`},
        }));

      (pool.query as Mock).mockResolvedValue({
        rows: mockEvents.map((event) => ({event_payload: event})),
      });

      const events = await roomModel.getRoomEvents(mockRid);
      expect(events).toHaveLength(10);
    });
  });

  describe('addRoomEvent', () => {
    it('should insert room event into database', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: 1234567890,
        type: RoomEventType.USER_PING,
        params: {
          uid: 'user123',
        },
        uid: 'user123',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO room_events'),
        expect.arrayContaining([
          mockRid,
          mockEvent.uid,
          expect.any(String), // ISO timestamp string
          mockEvent.type,
          mockEvent,
        ])
      );
    });

    it('should convert timestamp to ISO string', async () => {
      const mockRid = 'test-room-123';
      const timestamp = 1234567890000; // Milliseconds
      const mockEvent = {
        timestamp,
        type: RoomEventType.SET_GAME,
        params: {gid: 'game-123'},
        uid: 'user123',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      const callArgs = (pool.query as Mock).mock.calls[0][1];
      const isoString = callArgs[2];
      expect(isoString).toBe(new Date(timestamp).toISOString());
    });

    it('should handle invalid timestamp by using current time', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: NaN,
        type: RoomEventType.USER_PING,
        params: {uid: 'user123'},
        uid: 'user123',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      const callArgs = (pool.query as Mock).mock.calls[0][1];
      const isoString = callArgs[2];
      // Should be a valid ISO string (current time)
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle null timestamp', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: null as unknown as number,
        type: RoomEventType.SET_GAME,
        params: {gid: 'game-123'},
        uid: 'user123',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      const callArgs = (pool.query as Mock).mock.calls[0][1];
      const isoString = callArgs[2];
      // Should be a valid ISO string (current time fallback)
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle SET_GAME event', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: 1234567890,
        type: RoomEventType.SET_GAME,
        params: {
          gid: 'game-456',
        },
        uid: 'user123',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      expect(pool.query).toHaveBeenCalled();
      const callArgs = (pool.query as Mock).mock.calls[0][1];
      expect(callArgs[4].type).toBe(RoomEventType.SET_GAME);
      expect(callArgs[4].params.gid).toBe('game-456');
    });

    it('should handle USER_PING event', async () => {
      const mockRid = 'test-room-123';
      const mockEvent = {
        timestamp: 1234567890,
        type: RoomEventType.USER_PING,
        params: {
          uid: 'user789',
        },
        uid: 'user789',
      };

      (pool.query as Mock).mockResolvedValue({});

      await roomModel.addRoomEvent(mockRid, mockEvent);

      expect(pool.query).toHaveBeenCalled();
      const callArgs = (pool.query as Mock).mock.calls[0][1];
      expect(callArgs[4].type).toBe(RoomEventType.USER_PING);
      expect(callArgs[4].params.uid).toBe('user789');
    });
  });
});
