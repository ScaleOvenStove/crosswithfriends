import {describe, it, expect} from 'vitest';
import {RoomEventType} from '@shared/roomEvents';
import {validateRoomEvent, isValidRoomEvent} from '../../validation/roomEvents.js';

describe('Room Events Validation', () => {
  describe('validateRoomEvent', () => {
    describe('USER_PING event', () => {
      it('should validate a valid USER_PING event', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {
            uid: 'user123',
          },
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(true);
        expect(result.validatedEvent).toBeDefined();
        expect(result.error).toBeUndefined();
      });

      it('should reject USER_PING with uid mismatch', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {
            uid: 'user123',
          },
          uid: 'user456', // Different uid
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('uid mismatch');
      });

      it('should reject USER_PING with missing uid in params', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject USER_PING with empty uid in params', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {
            uid: '',
          },
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('SET_GAME event', () => {
      it('should validate a valid SET_GAME event', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.SET_GAME,
          params: {
            gid: 'game-123',
          },
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject SET_GAME with missing gid', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.SET_GAME,
          params: {},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject SET_GAME with empty gid', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.SET_GAME,
          params: {
            gid: '',
          },
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('base event structure', () => {
      it('should reject event with missing timestamp', () => {
        const event = {
          type: RoomEventType.USER_PING,
          params: {uid: 'user123'},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('timestamp');
      });

      it('should reject event with invalid timestamp (non-positive)', () => {
        const event = {
          timestamp: 0,
          type: RoomEventType.USER_PING,
          params: {uid: 'user123'},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with missing type', () => {
        const event = {
          timestamp: 1234567890,
          params: {uid: 'user123'},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with invalid type (not enum)', () => {
        const event = {
          timestamp: 1234567890,
          type: 'invalid_type',
          params: {uid: 'user123'},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with missing uid', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {uid: 'user123'},
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('uid');
      });

      it('should reject event with empty uid', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          params: {uid: 'user123'},
          uid: '',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with missing params', () => {
        const event = {
          timestamp: 1234567890,
          type: RoomEventType.USER_PING,
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null event', () => {
        const result = validateRoomEvent(null);
        expect(result.valid).toBe(false);
      });

      it('should handle undefined event', () => {
        const result = validateRoomEvent(undefined);
        expect(result.valid).toBe(false);
      });

      it('should handle non-object event', () => {
        const result = validateRoomEvent('not an object');
        expect(result.valid).toBe(false);
      });

      it('should handle event with non-number timestamp', () => {
        const event = {
          timestamp: 'not a number',
          type: RoomEventType.USER_PING,
          params: {uid: 'user123'},
          uid: 'user123',
        };

        const result = validateRoomEvent(event);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('isValidRoomEvent', () => {
    it('should return true for valid event', () => {
      const event = {
        timestamp: 1234567890,
        type: RoomEventType.SET_GAME,
        params: {
          gid: 'game-123',
        },
        uid: 'user123',
      };

      expect(isValidRoomEvent(event)).toBe(true);
    });

    it('should return false for invalid event', () => {
      const event = {
        timestamp: 1234567890,
        type: RoomEventType.USER_PING,
        params: {uid: 'user123'},
        uid: 'user456', // Mismatch
      };

      expect(isValidRoomEvent(event)).toBe(false);
    });

    it('should work as type guard', () => {
      const event: unknown = {
        timestamp: 1234567890,
        type: RoomEventType.SET_GAME,
        params: {
          gid: 'game-123',
        },
        uid: 'user123',
      };

      if (isValidRoomEvent(event)) {
        // TypeScript should know event has the correct type here
        expect(event.type).toBe(RoomEventType.SET_GAME);
        expect(event.timestamp).toBe(1234567890);
        expect(event.uid).toBe('user123');
      } else {
        throw new Error('Event should be valid');
      }
    });
  });
});
