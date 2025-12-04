/**
 * API Client Configuration
 *
 * This module provides a configured instance of the generated API client
 * with the correct base URL based on the environment.
 */

import {
  Configuration,
  CountersApi,
  GamesApi,
  HealthApi,
  LinkPreviewApi,
  PuzzlesApi,
  StatsApi,
} from './generated';
import { API_BASE_URL } from '../config';

/**
 * Base configuration for all API clients
 * Note: Content-Type is not set globally - the SDK will add it automatically
 * when there's a request body. This prevents issues with endpoints that don't
 * require a body (like POST /counters/gid).
 */
const configuration = new Configuration({
  basePath: API_BASE_URL,
});

/**
 * Configured API clients
 *
 * Import these instances instead of creating new ones:
 *
 * @example
 * ```typescript
 * import { healthApi, puzzlesApi, countersApi, gamesApi } from '@/api/apiClient';
 *
 * // Health check
 * const health = await healthApi.getHealth();
 *
 * // Get puzzle
 * const puzzle = await puzzlesApi.getPuzzleById('puzzle123');
 *
 * // Create puzzle
 * const result = await puzzlesApi.createPuzzle({
 *   puzzle: { ... },
 *   isPublic: true
 * });
 *
 * // Get new game ID
 * const { gid } = await countersApi.getNewGameId();
 *
 * // Create game
 * const game = await gamesApi.createGame({ gid: 'game123', pid: 'puzzle456' });
 * ```
 */
export const healthApi = new HealthApi(configuration);
export const puzzlesApi = new PuzzlesApi(configuration);
export const countersApi = new CountersApi(configuration);
export const gamesApi = new GamesApi(configuration);
export const statsApi = new StatsApi(configuration);
export const linkPreviewApi = new LinkPreviewApi(configuration);

/**
 * Re-export types for convenience
 */
export type {
  GetHealth200Response,
  CreatePuzzleRequest,
  CreatePuzzleRequestPuzzle,
  CreatePuzzleRequestPuzzleClues,
  CreatePuzzleRequestPuzzleDimensions,
  CreatePuzzle200Response,
  ListPuzzles400Response,
  GetNewGameId200Response,
  GetNewPuzzleId200Response,
  CreateGame200Response,
  CreateGameRequest,
  GetGameById200Response,
  SubmitStatsRequest,
  SubmitStats200Response,
  RecordPuzzleSolveRequest,
  GetOembed200Response,
} from './generated';
