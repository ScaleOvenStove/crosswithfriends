import {z} from 'zod';

// Base schemas for common types
const cellCoordsSchema = z.object({
  r: z.number().int().nonnegative(),
  c: z.number().int().nonnegative(),
});

// Game event parameter schemas
const createEventParamsSchema = z.object({
  pid: z.string().min(1),
  version: z.number().positive(),
  game: z.object({
    info: z.record(z.unknown()).optional(),
    grid: z.array(z.array(z.any())),
    solution: z.array(z.array(z.string())),
    circles: z.array(z.string()).optional(),
    chat: z
      .object({
        messages: z.array(z.any()),
      })
      .optional(),
    cursor: z.record(z.unknown()).optional(),
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

// Base game event schema
const baseGameEventSchema = z.object({
  user: z.string().optional(),
  timestamp: z.number().positive(),
  type: z.string(),
  params: z.unknown(),
});

// Event type to params schema mapping
const eventParamsSchemas: Record<string, z.ZodSchema> = {
  create: createEventParamsSchema,
  updateCell: updateCellEventParamsSchema,
  check: checkEventParamsSchema,
  reveal: revealEventParamsSchema,
  revealAllClues: revealAllCluesEventParamsSchema,
  startGame: startGameEventParamsSchema,
  sendChatMessage: sendChatMessageEventParamsSchema,
  updateDisplayName: updateDisplayNameEventParamsSchema,
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
  validatedEvent?: z.infer<typeof baseGameEventSchema> & {params: unknown};
} {
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
  if (!(type in eventParamsSchemas)) {
    return {
      valid: false,
      error: `Unknown event type: ${type}`,
    };
  }

  // Validate type-specific params
  const paramsSchema = eventParamsSchemas[type];
  const paramsResult = paramsSchema.safeParse(params);
  if (!paramsResult.success) {
    return {
      valid: false,
      error: `Invalid params for event type ${type}: ${paramsResult.error.message}`,
    };
  }

  return {
    valid: true,
    validatedEvent: {
      ...baseResult.data,
      params: paramsResult.data,
    },
  };
}

/**
 * Type guard to check if an event is a valid game event
 */
export function isValidGameEvent(event: unknown): event is z.infer<typeof baseGameEventSchema> {
  return validateGameEvent(event).valid;
}

