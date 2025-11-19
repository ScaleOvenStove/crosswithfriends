import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';
import * as countersModel from '../../model/counters.js';

// Mock the model
vi.mock('../../model/counters.js');

describe('Counters API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/counters/gid', () => {
    it('should increment and return gid', async () => {
      const mockGid = 'test-gid-123';
      (countersModel.incrementGid as Mock).mockResolvedValue(mockGid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({gid: mockGid});
      expect(countersModel.incrementGid).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      (countersModel.incrementGid as Mock).mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('Database error');
    });
  });

  describe('POST /api/counters/pid', () => {
    it('should increment and return pid', async () => {
      const mockPid = 'test-pid-456';
      (countersModel.incrementPid as Mock).mockResolvedValue(mockPid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/pid',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({pid: mockPid});
      expect(countersModel.incrementPid).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      (countersModel.incrementPid as Mock).mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/pid',
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
    });
  });
});
