import {describe, it, expect} from 'vitest';
import {validateGameEvent, isValidGameEvent} from '../../validation/gameEvents.js';

describe('Game Events Validation', () => {
  describe('validateGameEvent', () => {
    describe('create event', () => {
      it('should validate a valid create event', () => {
        const event = {
          user: 'user123',
          timestamp: 1234567890,
          type: 'create',
          params: {
            pid: 'puzzle-123',
            version: 1.0,
            game: {
              grid: [
                [
                  {value: '.', black: false},
                  {value: 'A', black: false},
                ],
              ],
              solution: [['.', 'A']],
              clues: {
                across: ['1', 'Test clue'],
                down: [],
              },
            },
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
        expect(result.validatedEvent).toBeDefined();
        expect(result.error).toBeUndefined();
      });

      it('should validate create event with optional fields', () => {
        const event = {
          timestamp: 1234567890,
          type: 'create',
          params: {
            pid: 'puzzle-123',
            version: 1.0,
            game: {
              info: {title: 'Test'},
              grid: [
                [
                  {value: '.', black: false},
                  {value: 'A', black: false},
                ],
              ],
              solution: [['.', 'A']],
              circles: ['0'],
              chat: {messages: []},
              cursor: {user1: {r: 0, c: 1}},
              clock: {
                lastUpdated: 1000,
                totalTime: 5000,
                trueTotalTime: 5000,
                paused: false,
              },
              solved: false,
              clues: {
                across: ['1', 'Test clue'],
                down: [],
              },
            },
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject create event with missing pid', () => {
        const event = {
          timestamp: 1234567890,
          type: 'create',
          params: {
            version: 1.0,
            game: {
              grid: [
                [
                  {value: '.', black: false},
                  {value: 'A', black: false},
                ],
              ],
              solution: [['.', 'A']],
              clues: {across: [], down: []},
            },
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('pid');
      });

      it('should reject create event with invalid version', () => {
        const event = {
          timestamp: 1234567890,
          type: 'create',
          params: {
            pid: 'puzzle-123',
            version: -1,
            game: {
              grid: [
                [
                  {value: '.', black: false},
                  {value: 'A', black: false},
                ],
              ],
              solution: [['.', 'A']],
              clues: {across: [], down: []},
            },
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('updateCell event', () => {
      it('should validate a valid updateCell event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateCell',
          params: {
            cell: {r: 0, c: 1},
            value: 'A',
            autocheck: false,
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject updateCell with negative coordinates', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateCell',
          params: {
            cell: {r: -1, c: 0},
            value: 'A',
            autocheck: false,
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject updateCell with missing id', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateCell',
          params: {
            cell: {r: 0, c: 1},
            value: 'A',
            autocheck: false,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('check event', () => {
      it('should validate a valid check event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'check',
          params: {
            scope: [{r: 0, c: 1}],
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject check event with empty scope', () => {
        const event = {
          timestamp: 1234567890,
          type: 'check',
          params: {
            scope: [],
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject check event with multiple cells in scope', () => {
        const event = {
          timestamp: 1234567890,
          type: 'check',
          params: {
            scope: [
              {r: 0, c: 1},
              {r: 0, c: 2},
            ],
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('reveal event', () => {
      it('should validate a valid reveal event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'reveal',
          params: {
            scope: [{r: 0, c: 1}],
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject reveal event with invalid scope', () => {
        const event = {
          timestamp: 1234567890,
          type: 'reveal',
          params: {
            scope: [{r: -1, c: 0}],
            id: 'user123',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('revealAllClues event', () => {
      it('should validate a valid revealAllClues event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'revealAllClues',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });
    });

    describe('startGame event', () => {
      it('should validate a valid startGame event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'startGame',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });
    });

    describe('sendChatMessage event', () => {
      it('should validate a valid sendChatMessage event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'sendChatMessage',
          params: {
            id: 'user123',
            message: 'Hello world',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject sendChatMessage with empty message', () => {
        const event = {
          timestamp: 1234567890,
          type: 'sendChatMessage',
          params: {
            id: 'user123',
            message: '',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject sendChatMessage with message too long', () => {
        const event = {
          timestamp: 1234567890,
          type: 'sendChatMessage',
          params: {
            id: 'user123',
            message: 'a'.repeat(1001),
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('updateDisplayName event', () => {
      it('should validate a valid updateDisplayName event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateDisplayName',
          params: {
            id: 'user123',
            displayName: 'John Doe',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject updateDisplayName with name too long', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateDisplayName',
          params: {
            id: 'user123',
            displayName: 'a'.repeat(101),
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('updateTeamName event', () => {
      it('should validate a valid updateTeamName event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamName',
          params: {
            teamId: 'team1',
            teamName: 'Team Alpha',
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });
    });

    describe('updateTeamId event', () => {
      it('should validate a valid updateTeamId event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamId',
          params: {
            id: 'user123',
            teamId: 1,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should validate updateTeamId with teamId 0', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamId',
          params: {
            id: 'user123',
            teamId: 0,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should validate updateTeamId with teamId 2', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamId',
          params: {
            id: 'user123',
            teamId: 2,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should reject updateTeamId with teamId out of range', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamId',
          params: {
            id: 'user123',
            teamId: 3,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject updateTeamId with negative teamId', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateTeamId',
          params: {
            id: 'user123',
            teamId: -1,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('updateCursor event', () => {
      it('should validate a valid updateCursor event', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateCursor',
          params: {
            id: 'user123',
            cell: {r: 0, c: 1},
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });

      it('should validate updateCursor with optional timestamp', () => {
        const event = {
          timestamp: 1234567890,
          type: 'updateCursor',
          params: {
            id: 'user123',
            cell: {r: 0, c: 1},
            timestamp: 1234567890,
          },
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(true);
      });
    });

    describe('base event structure', () => {
      it('should reject event with missing timestamp', () => {
        const event = {
          type: 'create',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('timestamp');
      });

      it('should reject event with invalid timestamp (non-positive)', () => {
        const event = {
          timestamp: 0,
          type: 'create',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with missing type', () => {
        const event = {
          timestamp: 1234567890,
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });

      it('should reject event with unknown type', () => {
        const event = {
          timestamp: 1234567890,
          type: 'unknownEventType',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unknown event type');
      });

      it('should reject event with missing params', () => {
        const event = {
          timestamp: 1234567890,
          type: 'create',
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null event', () => {
        const result = validateGameEvent(null);
        expect(result.valid).toBe(false);
      });

      it('should handle undefined event', () => {
        const result = validateGameEvent(undefined);
        expect(result.valid).toBe(false);
      });

      it('should handle non-object event', () => {
        const result = validateGameEvent('not an object');
        expect(result.valid).toBe(false);
      });

      it('should handle event with non-number timestamp', () => {
        const event = {
          timestamp: 'not a number',
          type: 'create',
          params: {},
        };

        const result = validateGameEvent(event);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('isValidGameEvent', () => {
    it('should return true for valid event', () => {
      const event = {
        timestamp: 1234567890,
        type: 'create',
        params: {
          pid: 'puzzle-123',
          version: 1.0,
          game: {
            grid: [
              [
                {value: '.', black: false},
                {value: 'A', black: false},
              ],
            ],
            solution: [['.', 'A']],
            clues: {across: [], down: []},
          },
        },
      };

      expect(isValidGameEvent(event)).toBe(true);
    });

    it('should return false for invalid event', () => {
      const event = {
        timestamp: 1234567890,
        type: 'create',
        params: {},
      };

      expect(isValidGameEvent(event)).toBe(false);
    });

    it('should work as type guard', () => {
      const event: unknown = {
        timestamp: 1234567890,
        type: 'updateCell',
        params: {
          cell: {r: 0, c: 1},
          value: 'A',
          autocheck: false,
          id: 'user123',
        },
      };

      if (isValidGameEvent(event)) {
        // TypeScript should know event has the correct type here
        expect(event.type).toBe('updateCell');
        expect(event.timestamp).toBe(1234567890);
      } else {
        throw new Error('Event should be valid');
      }
    });
  });
});
