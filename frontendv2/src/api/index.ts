/**
 * API client exports
 *
 * IMPORTANT: Type re-exports are removed to avoid triggering discriminator errors
 * during module evaluation. Import types directly from './apiClient' if needed.
 */

export * from './types';

// Export the generated API clients (lazy-loaded)
export {
  healthApi,
  puzzlesApi,
  countersApi,
  gamesApi,
  statsApi,
  linkPreviewApi,
} from './apiClient';

// Types are available from './apiClient' but not re-exported here to avoid eager evaluation
// Import types directly: import type { GetHealth200Response } from '@api/apiClient';
