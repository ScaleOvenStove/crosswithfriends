/**
 * API Client Configuration
 *
 * This module provides a configured instance of the generated API client
 * with the correct base URL based on the environment.
 */

import { API_BASE_URL } from '../config';
import {
  Configuration,
  CountersApi,
  GamesApi,
  HealthApi,
  LinkPreviewApi,
  PuzzlesApi,
  StatsApi,
} from './generated';

// Create configuration
const configuration = new Configuration({
  basePath: API_BASE_URL,
});

// Export configured API instances
export const healthApi = new HealthApi(configuration);
export const puzzlesApi = new PuzzlesApi(configuration);
export const countersApi = new CountersApi(configuration);
export const gamesApi = new GamesApi(configuration);
export const statsApi = new StatsApi(configuration);
export const linkPreviewApi = new LinkPreviewApi(configuration);

// Re-export ResponseError for convenience
export { ResponseError } from './generated/runtime';

// Type re-exports removed - import types directly from '@api/generated' when needed
// This avoids any potential issues with type-only imports triggering module evaluation
