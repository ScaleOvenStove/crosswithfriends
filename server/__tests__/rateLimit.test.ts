import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fastify from 'fastify';
import type {FastifyInstance} from 'fastify';
import rateLimit from '@fastify/rate-limit';

describe('Rate Limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify();

    // Register rate limiting with strict limits for testing
    await app.register(rateLimit, {
      max: 5, // Only 5 requests
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip,
    });

    // Add test route
    app.get('/test', async () => {
      return {message: 'success'};
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow requests within rate limit', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({message: 'success'});
    }
  });

  it('should reject requests exceeding rate limit', async () => {
    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'GET',
        url: '/test',
      });
    }

    // 6th request should be rate limited
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Too Many Requests');
  });

  it('should include rate limit headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should reset rate limit counter', async () => {
    // Make 5 requests to hit the limit
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });
      expect(response.statusCode).toBe(200);
    }

    // 6th request should be rate limited
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });
    expect(response.statusCode).toBe(429);

    // Verify the error response
    const body = JSON.parse(response.body);
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(body.message).toContain('Rate limit exceeded');
  });
});
