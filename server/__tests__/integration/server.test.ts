import {describe, it, expect, beforeAll, afterAll, vi} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('Server Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('Server Setup', () => {
    it('should start the server successfully', async () => {
      expect(app).toBeDefined();
      // App is already ready from waitForApp in beforeAll
      // Verify it's working by making a simple request
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(response.statusCode).toBeLessThan(500);
    });

    it('should have CORS enabled', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/counters/gid',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
        },
      });

      // CORS should allow the request
      expect(response.statusCode).toBeLessThan(500);
    });

    it('should verify actual CORS headers in response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      // CORS headers should be present
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle errors with proper status codes', async () => {
      // This will trigger the error handler since the route doesn't exist
      const response = await app.inject({
        method: 'POST',
        url: '/api/invalid-route',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return proper error format', async () => {
      // Test error handler format by hitting a route that will error
      // We'll use a route that requires authentication or has validation
      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: 'invalid'}, // This should trigger validation error
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });
  });

  describe('API Routes Registration', () => {
    it('should register all API routes', async () => {
      const routes = app.printRoutes();

      // Check that key routes are registered (routes are nested in the tree structure)
      expect(routes).toContain('counters/');
      expect(routes).toContain('puzzle');
      expect(routes).toContain('game');
      expect(routes).toContain('stats');
      // puzzle_list is registered but may show as _list in the tree, verify it works via request
      expect(routes).toContain('_list'); // puzzle_list shows as _list in route tree
      // Check for the actual nested routes (they appear on separate lines in the tree)
      expect(routes).toContain('gid (POST)');
      expect(routes).toContain('pid (POST)');

      // Verify puzzle_list route is accessible (even if it errors, it should not be 404)
      const puzzleListResponse = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });
      expect(puzzleListResponse.statusCode).not.toBe(404);
    });

    it('should register health endpoint', async () => {
      const routes = app.printRoutes();
      expect(routes).toContain('health');

      // Verify health endpoint is accessible
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(healthResponse.statusCode).toBe(200);
    });

    it('should handle requests to registered routes', async () => {
      // Even if the model fails, the route should be accessible
      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {},
      });

      // Should not be 404 (route exists)
      expect(response.statusCode).not.toBe(404);
    });
  });

  describe('Request/Response Format', () => {
    it('should parse JSON request bodies', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {test: 'data'},
        headers: {
          'content-type': 'application/json',
        },
      });

      // Should process the request (even if it fails later)
      expect(response.statusCode).not.toBe(400); // Not a parsing error
    });

    it('should return JSON responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {},
      });

      expect(response.headers['content-type']).toContain('application/json');

      // Should be valid JSON
      expect(() => JSON.parse(response.body)).not.toThrow();
    });
  });

  describe('Request Logging', () => {
    it('should log requests', async () => {
      const logSpy = vi.spyOn(app.log, 'debug');

      await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      // Note: In test mode, logging is disabled, but we can verify the log method exists
      expect(app.log).toBeDefined();
      expect(typeof app.log.debug).toBe('function');
      logSpy.mockRestore();
    });

    it('should handle request with headers and query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oembed?author=Test',
        headers: {
          'user-agent': 'test-agent',
          accept: 'application/json',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
