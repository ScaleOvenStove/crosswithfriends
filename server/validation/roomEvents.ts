import {z} from 'zod';
import {RoomEventType} from '@shared/roomEvents';

// Room event parameter schemas
const userPingEventParamsSchema = z.object({
  uid: z.string().min(1),
});

const setGameEventParamsSchema = z.object({
  gid: z.string().min(1),
});

// Base room event schema
const baseRoomEventSchema = z.object({
  timestamp: z.number().positive(),
  type: z.nativeEnum(RoomEventType),
  params: z.unknown(),
  uid: z.string().min(1),
});

// Event type to params schema mapping
const roomEventParamsSchemas: Record<RoomEventType, z.ZodSchema> = {
  [RoomEventType.USER_PING]: userPingEventParamsSchema,
  [RoomEventType.SET_GAME]: setGameEventParamsSchema,
};

/**
 * Validates a room event against its type-specific schema
 */
export function validateRoomEvent(event: unknown): {
  valid: boolean;
  error?: string;
  validatedEvent?: z.infer<typeof baseRoomEventSchema> & {params: unknown};
} {
  // First validate base structure
  const baseResult = baseRoomEventSchema.safeParse(event);
  if (!baseResult.success) {
    return {
      valid: false,
      error: `Invalid base room event structure: ${baseResult.error.message}`,
    };
  }

  const {type, params, uid} = baseResult.data;

  // Validate type-specific params
  const paramsSchema = roomEventParamsSchemas[type];
  if (!paramsSchema) {
    return {
      valid: false,
      error: `Unknown room event type: ${type}`,
    };
  }

  const paramsResult = paramsSchema.safeParse(params);
  if (!paramsResult.success) {
    return {
      valid: false,
      error: `Invalid params for room event type ${type}: ${paramsResult.error.message}`,
    };
  }

  // For USER_PING, ensure uid in params matches event uid
  if (type === RoomEventType.USER_PING) {
    const pingParams = paramsResult.data as {uid: string};
    if (pingParams.uid !== uid) {
      return {
        valid: false,
        error: `USER_PING event uid mismatch: event.uid=${uid}, params.uid=${pingParams.uid}`,
      };
    }
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
 * Type guard to check if an event is a valid room event
 */
export function isValidRoomEvent(event: unknown): event is z.infer<typeof baseRoomEventSchema> {
  return validateRoomEvent(event).valid;
}

