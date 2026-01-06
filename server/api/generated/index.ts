/**
 * Convenience type exports from OpenAPI-generated types
 * This file provides easy-to-use type aliases for request/response bodies
 */

import type {operations} from './types.js';

// ============================================================================
// Helper Types
// ============================================================================

/** Extract the request body type from an operation */
type RequestBody<T extends keyof operations> = operations[T] extends {
  requestBody: {content: {'application/json': infer R}};
}
  ? R
  : operations[T] extends {requestBody?: {content: {'application/json': infer R}}}
    ? R | undefined
    : never;

/** Extract the 200 response body type from an operation */
type ResponseBody<T extends keyof operations> = operations[T] extends {
  responses: {200: {content: {'application/json': infer R}}};
}
  ? R
  : never;

// ============================================================================
// Game Types
// ============================================================================

/** Request body for POST /game (createGame) */
export type CreateGameRequest = RequestBody<'createGame'>;

/** Response body for POST /game (createGame) */
export type CreateGameResponse = ResponseBody<'createGame'>;

/** Response body for GET /game/:gid (getGameById) */
export type GetGameResponse = ResponseBody<'getGameById'>;

/** Response body for GET /game/:gid/pid (getActiveGamePid) */
export type GetActiveGamePidResponse = ResponseBody<'getActiveGamePid'>;

// ============================================================================
// Puzzle Types
// ============================================================================

/** Request body for POST /puzzle (createPuzzle) */
export type CreatePuzzleRequest = RequestBody<'createPuzzle'>;

/** Response body for POST /puzzle (createPuzzle) */
export type CreatePuzzleResponse = ResponseBody<'createPuzzle'>;

/** Response body for GET /puzzle/:pid (getPuzzleById) */
export type GetPuzzleResponse = ResponseBody<'getPuzzleById'>;

/** Response body for GET /puzzle_list (listPuzzles) */
export type ListPuzzlesResponse = ResponseBody<'listPuzzles'>;

// ============================================================================
// Record Solve Types
// ============================================================================

/** Request body for POST /record_solve/:pid (recordPuzzleSolve) */
export type RecordSolveRequest = RequestBody<'recordPuzzleSolve'>;

/** Response body for POST /record_solve/:pid (recordPuzzleSolve) */
export type RecordSolveResponse = ResponseBody<'recordPuzzleSolve'>;

// ============================================================================
// Stats Types
// ============================================================================

/** Request body for POST /stats (submitStats) */
export type ListPuzzleStatsRequest = RequestBody<'submitStats'>;

/** Response body for POST /stats (submitStats) */
export type ListPuzzleStatsResponse = ResponseBody<'submitStats'>;

// ============================================================================
// Counter Types
// ============================================================================

/** Response body for POST /counters/gid (getNewGameId) */
export type IncrementGidResponse = ResponseBody<'getNewGameId'>;

/** Response body for POST /counters/pid (getNewPuzzleId) */
export type IncrementPidResponse = ResponseBody<'getNewPuzzleId'>;

// ============================================================================
// Auth Types
// ============================================================================

/** Request body for POST /auth/token (createToken) */
export type CreateTokenRequest = RequestBody<'createToken'>;

/** Response body for POST /auth/token (createToken) */
export type CreateTokenResponse = ResponseBody<'createToken'>;

/** Request body for POST /auth/firebase-token (exchangeFirebaseToken) */
export type ExchangeFirebaseTokenRequest = RequestBody<'exchangeFirebaseToken'>;

/** Response body for POST /auth/firebase-token (exchangeFirebaseToken) */
export type ExchangeFirebaseTokenResponse = ResponseBody<'exchangeFirebaseToken'>;

/** Request body for POST /auth/validate (validateToken) */
export type ValidateTokenRequest = RequestBody<'validateToken'>;

/** Response body for POST /auth/validate (validateToken) */
export type ValidateTokenResponse = ResponseBody<'validateToken'>;

/** Response body for GET /auth/me (getCurrentUser) */
export type GetCurrentUserResponse = ResponseBody<'getCurrentUser'>;

// ============================================================================
// Health Types
// ============================================================================

/** Response body for GET /health (getHealth) */
export type HealthResponse = ResponseBody<'getHealth'>;

// ============================================================================
// Link Preview Types
// ============================================================================

/** Response body for GET /oembed (getOembed) */
export type OEmbedResponse = ResponseBody<'getOembed'>;

// Re-export the full types module for advanced use cases
export * from './types.js';
