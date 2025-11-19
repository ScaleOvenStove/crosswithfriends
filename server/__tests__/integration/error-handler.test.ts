import {describe, it, expect, beforeAll, afterAll, vi} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';
import {FastifyError} from 'fastify';

describe('Error Handler Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();

    // Add test routes before app is ready
    app.get('/test-error', async () => {
      const error = new Error('Test error') as FastifyError;
      error.statusCode = 418;
      throw error;
    });

    app.get('/test-error-500', async () => {
      throw new Error('Internal server error');
    });

    app.get('/test-validation', async () => {
      const error = new Error('Validation failed') as FastifyError;
      error.validation = [
        {
          message: 'Invalid field',
          keyword: 'required',
          params: {},
          instancePath: '.field',
          schemaPath: '#/properties/field',
        } as any, // Type assertion needed for test mock
      ];
      throw error;
    });

    app.get('/test-logging', async () => {
      throw new Error('Error to log');
    });

    app.get('/test-error-no-name', async () => {
      const error = new Error('Error without name') as FastifyError;
      error.statusCode = 400;
      delete (error as any).name;
      throw error;
    });

    app.get('/test-error-custom-name', async () => {
      const error = new Error('Custom error') as FastifyError;
      error.statusCode = 403;
      error.name = 'CustomError';
      throw error;
    });

    app.get('/test-error-no-message', async () => {
      const error = new Error() as FastifyError;
      error.statusCode = 500;
      throw error;
    });

    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('Error Response Format', () => {
    it('should format errors with statusCode correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-error',
      });

      expect(response.statusCode).toBe(418);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        statusCode: 418,
        error: 'Error',
        message: 'Test error',
      });
    });

    it('should handle errors without statusCode as 500', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-error-500',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.error).toBe('Error');
      expect(body.message).toBe('Internal server error');
    });

    it('should handle validation errors with 400 status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-validation',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Validation error');
      expect(body.validation).toBeDefined();
    });
  });

  describe('Error Logging', () => {
    it('should log errors when they occur', async () => {
      const logSpy = vi.spyOn(app.log, 'error');

      await app.inject({
        method: 'GET',
        url: '/test-logging',
      });

      // Error should be logged
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should log errors with correct error object', async () => {
      const logSpy = vi.spyOn(app.log, 'error');

      await app.inject({
        method: 'GET',
        url: '/test-error',
      });

      // Error should be logged with the error object
      expect(logSpy).toHaveBeenCalled();
      const loggedError = logSpy.mock.calls[0]?.[0];
      expect(loggedError).toBeInstanceOf(Error);
      expect((loggedError as Error).message).toBe('Test error');
      logSpy.mockRestore();
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle error without name property', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-error-no-name',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Internal Server Error'); // Default when name is missing
      expect(body.message).toBe('Error without name');
    });

    it('should handle error with custom error name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-error-custom-name',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(403);
      expect(body.error).toBe('CustomError');
      expect(body.message).toBe('Custom error');
    });

    it('should handle error without message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-error-no-message',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('An error occurred'); // Default message
    });
  });
});
