/**
 * API Client Configuration
 *
 * This module provides a configured instance of the generated API client
 * with the correct base URL based on the environment.
 */

import { API_BASE_URL } from '../config';
import { getBackendToken, refreshBackendTokenIfNeeded } from '../services/authTokenService';
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
    // Try to get existing token, or refresh if needed
    let token = await getBackendToken(true); // Refresh if expiring soon

    // If no token, try to refresh it (e.g., if expired or missing)
    if (!token) {
      token = await refreshBackendTokenIfNeeded();
    }

    if (token) {
      // Add Authorization header if token exists
      context.init.headers = {
        ...context.init.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return context;
  },
  post: async (context) => {
    // Handle 401 Unauthorized responses by refreshing token and retrying
    if (context.response.status === 401) {
      // Force refresh the token
      const newToken = await refreshBackendTokenIfNeeded(true);

      if (newToken) {
        // Retry the request with the new token
        const retryInit = {
          ...context.init,
          headers: {
            ...context.init.headers,
            Authorization: `Bearer ${newToken}`,
          },
        };

        try {
          const retryResponse = await context.fetch(context.url, retryInit);

          // Only return the retry response if it's successful (not another 401)
          if (retryResponse.status !== 401) {
            return retryResponse;
          }
        } catch (err) {
          // If retry fails, return original 401 response
          console.error('[API Client] Token refresh retry failed:', err);
        }
      }
    }

    // Return original response for non-401 or if refresh failed
    return context.response;
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
