import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('OEmbed API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('GET /api/oembed', () => {
    it('should return oembed response with author', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oembed?author=Test%20Author',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        type: 'link',
        version: '1.0',
        author_name: 'Test Author',
      });
    });

    it('should handle missing author parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oembed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('type');
      expect(body).toHaveProperty('version');
    });

    it('should handle empty string author parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oembed?author=',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        type: 'link',
        version: '1.0',
        author_name: '',
      });
    });

    it('should handle special characters in author (URL encoding)', async () => {
      const specialAuthor = 'Author & Co. <test> "quotes"';
      const encodedAuthor = encodeURIComponent(specialAuthor);
      const response = await app.inject({
        method: 'GET',
        url: `/api/oembed?author=${encodedAuthor}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        type: 'link',
        version: '1.0',
        author_name: specialAuthor,
      });
    });

    it('should handle unicode characters in author', async () => {
      const unicodeAuthor = 'Автор 作者 🎨';
      const encodedAuthor = encodeURIComponent(unicodeAuthor);
      const response = await app.inject({
        method: 'GET',
        url: `/api/oembed?author=${encodedAuthor}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        type: 'link',
        version: '1.0',
        author_name: unicodeAuthor,
      });
    });

    it('should handle very long author strings', async () => {
      const longAuthor = 'A'.repeat(1000);
      const encodedAuthor = encodeURIComponent(longAuthor);
      const response = await app.inject({
        method: 'GET',
        url: `/api/oembed?author=${encodedAuthor}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        type: 'link',
        version: '1.0',
        author_name: longAuthor,
      });
    });

    it('should verify proper URL encoding/decoding', async () => {
      const authorWithSpaces = 'John Doe';
      const response = await app.inject({
        method: 'GET',
        url: `/api/oembed?author=${encodeURIComponent(authorWithSpaces)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.author_name).toBe(authorWithSpaces);
    });
  });
});
