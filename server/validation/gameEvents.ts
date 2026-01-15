import {z} from 'zod';

import type {GameEvent, GameEventType} from '../model/game.js';
import {isObject} from '../utils/typeGuards.js';

// Base schemas for common types
const cellCoordsSchema = z.object({
  r: z.number().int().nonnegative(),
  c: z.number().int().nonnegative(),
});

// Schema for grid cell data
const cellDataSchema = z
  .object({
    value: z.string().optional(),
    black: z.boolean().optional(),
    number: z.number().optional(),
    revealed: z.boolean().optional(),
    bad: z.boolean().optional(),
    good: z.boolean().optional(),
    pencil: z.boolean().optional(),
    isHidden: z.boolean().optional(),
    solvedBy: z
      .object({
        id: z.string(),
        teamId: z.number(),
      })
      .optional(),
    parents: z
      .object({
        across: z.number(),
        down: z.number(),
      })
      .optional(),
  })
  .passthrough(); // Allow additional properties

// Schema for chat message
const chatMessageSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    message: z.string(),
    timestamp: z.number().optional(),
  })
  .passthrough(); // Allow additional properties

// Game event parameter schemas
const createEventParamsSchema = z.object({
  pid: z.string().min(1),
  version: z.number().positive().optional(), // Optional for backward compatibility
  game: z.object({
    info: z.record(z.string(), z.unknown()).optional(),
    grid: z.array(z.array(cellDataSchema)),
    solution: z.array(z.array(z.string())),
    circles: z.array(z.string()).optional(),
    chat: z
      .object({
        messages: z.array(chatMessageSchema),
      })
      .optional(),
    cursor: z.record(z.string(), z.unknown()).optional(),
    clock: z
      .object({
        lastUpdated: z.number(),
        totalTime: z.number(),
        trueTotalTime: z.number(),
        paused: z.boolean(),
      })
      .optional(),
    solved: z.boolean().optional(),
    clues: z.object({
      across: z.array(z.string()),
      down: z.array(z.string()),
    }),
  }),
});

const updateCellEventParamsSchema = z.object({
  cell: cellCoordsSchema,
  value: z.string(),
  autocheck: z.boolean(),
  id: z.string().min(1),
});

const checkEventParamsSchema = z.object({
  scope: z.array(cellCoordsSchema).min(1).max(1), // Must be exactly 1 cell
  id: z.string().min(1),
});

const revealEventParamsSchema = z.object({
  scope: z.array(cellCoordsSchema).min(1).max(1), // Must be exactly 1 cell
  id: z.string().min(1),
});

const revealAllCluesEventParamsSchema = z.object({});

const startGameEventParamsSchema = z.object({});

const addPingEventParamsSchema = z.object({}).passthrough();
const updateColorEventParamsSchema = z.object({}).passthrough();
const updateClockEventParamsSchema = z.object({}).passthrough();
const resetEventParamsSchema = z.object({}).passthrough();
const chatEventParamsSchema = z.object({}).passthrough();

const sendChatMessageEventParamsSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).max(1000), // Reasonable message length limit
});

const updateDisplayNameEventParamsSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(100), // Reasonable name length
});

const updateTeamNameEventParamsSchema = z.object({
  teamId: z.string().min(1),
  teamName: z.string().min(1).max(100),
});

const updateTeamIdEventParamsSchema = z.object({
  id: z.string().min(1),
  teamId: z.number().int().min(0).max(2), // Valid team IDs are 0, 1, 2
});

const updateCursorEventParamsSchema = z.object({
  id: z.string().min(1),
  cell: cellCoordsSchema,
  timestamp: z.number().optional(),
});

const gameEventTypeValues = [
  'create',
  'updateCell',
  'updateCursor',
  'addPing',
  'updateDisplayName',
  'updateColor',
  'updateClock',
  'check',
  'reveal',
  'reset',
  'chat',
  'sendChatMessage',
  'updateTeamName',
  'updateTeamId',
  'revealAllClues',
  'startGame',
] as const;

const gameEventTypeSchema = z.enum(gameEventTypeValues);

// Base game event schema
const baseGameEventSchema = z.object({
  user: z.string().optional(),
  timestamp: z.number().positive(),
  type: gameEventTypeSchema,
  params: z.unknown(),
});

// Event type to params schema mapping
const eventParamsSchemas: Record<GameEventType, z.ZodSchema> = {
  create: createEventParamsSchema,
  updateCell: updateCellEventParamsSchema,
  addPing: addPingEventParamsSchema,
  check: checkEventParamsSchema,
  reveal: revealEventParamsSchema,
  revealAllClues: revealAllCluesEventParamsSchema,
  startGame: startGameEventParamsSchema,
  sendChatMessage: sendChatMessageEventParamsSchema,
  updateDisplayName: updateDisplayNameEventParamsSchema,
  updateColor: updateColorEventParamsSchema,
  updateClock: updateClockEventParamsSchema,
  reset: resetEventParamsSchema,
  chat: chatEventParamsSchema,
  updateTeamName: updateTeamNameEventParamsSchema,
  updateTeamId: updateTeamIdEventParamsSchema,
  updateCursor: updateCursorEventParamsSchema,
};

/**
 * Validates a game event against its type-specific schema
 */
export function validateGameEvent(event: unknown): {
  valid: boolean;
  error?: string;
  validatedEvent?: GameEvent;
} {
  if (isObject(event) && 'type' in event && typeof event.type === 'string') {
    if (!(event.type in eventParamsSchemas)) {
      return {
        valid: false,
        error: `Unknown event type: ${event.type}`,
      };
    }
  }
  // First validate base structure
  const baseResult = baseGameEventSchema.safeParse(event);
  if (!baseResult.success) {
    return {
      valid: false,
      error: `Invalid base event structure: ${baseResult.error.message}`,
    };
  }

  const {type, params} = baseResult.data;

  // Check if event type is known
  const paramsSchema = eventParamsSchemas[type];
  if (!paramsSchema) {
    return {
      valid: false,
      error: `Unknown event type: ${type}`,
    };
  }

  // Validate type-specific params
  const paramsResult = paramsSchema.safeParse(params);
  if (!paramsResult.success) {
    return {
      valid: false,
      error: `Invalid params for event type ${type}: ${paramsResult.error.message}`,
    };
  }

  const validatedEvent: GameEvent = {
    ...baseResult.data,
    type,
    params: paramsResult.data as GameEvent['params'],
  };

  return {
    valid: true,
    validatedEvent,
  };
}

/**
 * Type guard to check if an event is a valid game event
 */
export function isValidGameEvent(event: unknown): event is z.infer<typeof baseGameEventSchema> {
  return validateGameEvent(event).valid;
}
