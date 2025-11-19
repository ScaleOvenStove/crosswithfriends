import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('Health API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('GET /api/health', () => {
    it('should return health status with all required fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });

    it('should return status as "ok"', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });

    it('should return a valid ISO timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(typeof body.timestamp).toBe('string');
      // Verify it's a valid ISO string by parsing it
      const timestamp = new Date(body.timestamp);
      expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    it('should return uptime as a number', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
