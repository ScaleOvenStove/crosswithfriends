import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

function buildTestApp(limiter: any) {
  const app = express();
  app.use(limiter);
  app.get('/test-route', (_req, res) => res.json({ok: true}));
  app.post('/test-route', (_req, res) => res.json({ok: true}));
  return app;
}

describe('API Rate Limiters Integration', () => {
  describe('Global API Rate Limiter', () => {
    // 500 requests per 15 mins. Let's test a mock limiter with lower settings that replicates its config behavior.
    const globalLimiterConfig = {
      windowMs: 15 * 60 * 1000,
      limit: 5, // lowered for testing
      standardHeaders: 'draft-7' as const,
      legacyHeaders: false,
      message: {error: 'Too many requests, please try again later.'},
    };

    it('allows requests under the limit and blocks exceeding requests', async () => {
      const app = buildTestApp(rateLimit(globalLimiterConfig));
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/test-route');
        expect(res.status).toBe(200);
      }
      const blockedRes = await request(app).get('/test-route');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({error: 'Too many requests, please try again later.'});
    });
  });

  describe('Puzzle Upload Rate Limiter', () => {
    // 20 uploads per hour.
    const uploadLimiterConfig = {
      windowMs: 60 * 60 * 1000,
      limit: 3, // lowered for testing
      standardHeaders: 'draft-7' as const,
      legacyHeaders: false,
      message: {error: 'Upload limit exceeded. You can upload up to 20 puzzles per hour.'},
    };

    it('blocks uploads after limit is exceeded', async () => {
      const app = buildTestApp(rateLimit(uploadLimiterConfig));
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/test-route');
        expect(res.status).toBe(200);
      }
      const blockedRes = await request(app).post('/test-route');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({
        error: 'Upload limit exceeded. You can upload up to 20 puzzles per hour.',
      });
    });
  });

  describe('Game Creation Rate Limiter', () => {
    // 20 games per 15 minutes.
    const createGameLimiterConfig = {
      windowMs: 15 * 60 * 1000,
      limit: 2, // lowered for testing
      standardHeaders: 'draft-7' as const,
      legacyHeaders: false,
      message: {error: 'Game creation limit exceeded. Please try again later.'},
    };

    it('blocks game creation after limit is exceeded', async () => {
      const app = buildTestApp(rateLimit(createGameLimiterConfig));
      for (let i = 0; i < 2; i++) {
        const res = await request(app).post('/test-route');
        expect(res.status).toBe(200);
      }
      const blockedRes = await request(app).post('/test-route');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body).toEqual({error: 'Game creation limit exceeded. Please try again later.'});
    });
  });
});
