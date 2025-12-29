/**
 * API Client Configuration
 *
 * This module provides a configured instance of the generated API client
 * with the correct base URL based on the environment.
 */

import { API_BASE_URL } from '../config';
import { getBackendToken } from '../services/authTokenService';
import {
  Configuration,
  CountersApi,
  GamesApi,
  HealthApi,
  LinkPreviewApi,
  PuzzlesApi,
  StatsApi,
  type Middleware,
} from './generated';

// Middleware to automatically add backend JWT token to requests
const authMiddleware: Middleware = {
  pre: async (context) => {
    const token = getBackendToken();
    if (token) {
      // Add Authorization header if token exists
      context.init.headers = {
        ...context.init.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return context;
  },
};

// Create configuration with auth middleware
const configuration = new Configuration({
  basePath: API_BASE_URL,
  middleware: [authMiddleware],
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
