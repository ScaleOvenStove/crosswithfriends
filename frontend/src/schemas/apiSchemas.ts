/**
 * Zod schemas for API response validation
 * Validates responses from the backend API
 */

import { z } from 'zod';

// Game info response
export const gameInfoSchema = z
  .object({
    gid: z.string(),
    pid: z.string().optional(),
    solved: z.boolean().optional(),
    size: z.string().optional(),
  })
  .passthrough();

// Active game info (from /game/:gid/pid endpoint)
export const activeGameInfoSchema = z
  .object({
    pid: z.string().optional(),
  })
  .passthrough();

// Join game response
export const joinGameResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().optional(),
});

// Sync events response
export const syncEventsResponseSchema = z.union([
  z.array(z.unknown()), // Array of events
  z.object({
    error: z.string(),
  }),
]);

// Type inference
export type GameInfo = z.infer<typeof gameInfoSchema>;
export type ActiveGameInfo = z.infer<typeof activeGameInfoSchema>;
export type JoinGameResponse = z.infer<typeof joinGameResponseSchema>;
export type SyncEventsResponse = z.infer<typeof syncEventsResponseSchema>;

// Validation helpers
export function validateGameInfo(data: unknown): GameInfo {
  return gameInfoSchema.parse(data);
}

export function validateActiveGameInfo(data: unknown): ActiveGameInfo {
  return activeGameInfoSchema.parse(data);
}

export function validateJoinGameResponse(data: unknown): JoinGameResponse {
  return joinGameResponseSchema.parse(data);
}

export function validateSyncEventsResponse(data: unknown): SyncEventsResponse {
  return syncEventsResponseSchema.parse(data);
}
