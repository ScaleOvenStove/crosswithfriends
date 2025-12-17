/**
 * Zod schemas for game event validation
 * Validates socket events to ensure type safety
 */

import { z } from 'zod';

// Cell coordinates
const cellSchema = z.object({
  r: z.number().int().nonnegative(),
  c: z.number().int().nonnegative(),
});

// Base game event schema
const baseGameEventSchema = z.object({
  type: z.string(),
  user: z.string(),
  timestamp: z.number().int().nonnegative(),
  params: z.record(z.unknown()),
});

// UpdateCell event
export const updateCellEventSchema = baseGameEventSchema.extend({
  type: z.literal('updateCell'),
  params: z.object({
    cell: cellSchema,
    value: z.string(),
    autocheck: z.boolean().optional(),
    id: z.string().optional(),
  }),
});

// UpdateCursor event
export const updateCursorEventSchema = baseGameEventSchema.extend({
  type: z.literal('updateCursor'),
  params: z.object({
    id: z.string(),
    cell: cellSchema,
    timestamp: z.number().int().nonnegative(),
  }),
});

// Clock events
export const clockStartEventSchema = baseGameEventSchema.extend({
  type: z.literal('clockStart'),
  params: z.object({}).passthrough(),
});

export const clockPauseEventSchema = baseGameEventSchema.extend({
  type: z.literal('clockPause'),
  params: z.object({}).passthrough(),
});

export const clockResetEventSchema = baseGameEventSchema.extend({
  type: z.literal('clockReset'),
  params: z.object({}).passthrough(),
});

// Game completion event - split into two schemas for discriminated union
export const puzzleCompleteEventSchema = baseGameEventSchema.extend({
  type: z.literal('puzzle_complete'),
  params: z.object({}).passthrough(),
});

export const gameCompleteEventSchema = baseGameEventSchema.extend({
  type: z.literal('gameComplete'),
  params: z.object({}).passthrough(),
});

// Union of all game event types
// Note: baseGameEventSchema is excluded because discriminatedUnion requires all schemas
// to have literal types for the discriminator field, not z.string()
export const gameEventSchema = z.discriminatedUnion('type', [
  updateCellEventSchema,
  updateCursorEventSchema,
  clockStartEventSchema,
  clockPauseEventSchema,
  clockResetEventSchema,
  puzzleCompleteEventSchema,
  gameCompleteEventSchema,
]);

// Socket event wrapper (what we receive from socket)
export const socketGameEventSchema = z.object({
  gid: z.string(),
  event: gameEventSchema,
});

// Type inference
export type GameEvent = z.infer<typeof gameEventSchema>;
export type UpdateCellEvent = z.infer<typeof updateCellEventSchema>;
export type UpdateCursorEvent = z.infer<typeof updateCursorEventSchema>;
export type ClockStartEvent = z.infer<typeof clockStartEventSchema>;
export type ClockPauseEvent = z.infer<typeof clockPauseEventSchema>;
export type ClockResetEvent = z.infer<typeof clockResetEventSchema>;
export type PuzzleCompleteEvent = z.infer<typeof puzzleCompleteEventSchema>;
export type GameCompleteEvent = z.infer<typeof gameCompleteEventSchema>;
export type SocketGameEvent = z.infer<typeof socketGameEventSchema>;

// Validation helpers
export function validateGameEvent(data: unknown): GameEvent {
  return gameEventSchema.parse(data);
}

export function safeValidateGameEvent(data: unknown): {
  success: boolean;
  data?: GameEvent;
  error?: z.ZodError;
} {
  const result = gameEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateSocketGameEvent(data: unknown): SocketGameEvent {
  return socketGameEventSchema.parse(data);
}
