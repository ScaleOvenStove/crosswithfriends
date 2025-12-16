import {describe, it, expect, beforeAll, afterAll, beforeEach, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

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
    // Reset all mocks
    const countersRepo = (
      app as FastifyInstance & {repositories: {counters: {getNextGameId: Mock; getNextPuzzleId: Mock}}}
    ).repositories.counters;
    (countersRepo.getNextGameId as Mock).mockReset();
    (countersRepo.getNextPuzzleId as Mock).mockReset();
  });

  describe('POST /api/counters/gid', () => {
    it('should increment and return gid', async () => {
      const mockGid = 'test-gid-123';
      const countersRepo = (
        app as FastifyInstance & {repositories: {counters: {getNextGameId: Mock; getNextPuzzleId: Mock}}}
      ).repositories.counters;
      (countersRepo.getNextGameId as Mock).mockResolvedValue(mockGid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/gid',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({gid: mockGid});
      expect(countersRepo.getNextGameId).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      const countersRepo = (
        app as FastifyInstance & {repositories: {counters: {getNextGameId: Mock; getNextPuzzleId: Mock}}}
      ).repositories.counters;
      (countersRepo.getNextGameId as Mock).mockRejectedValue(error);

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
      const countersRepo = (
        app as FastifyInstance & {repositories: {counters: {getNextGameId: Mock; getNextPuzzleId: Mock}}}
      ).repositories.counters;
      (countersRepo.getNextPuzzleId as Mock).mockResolvedValue(mockPid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/counters/pid',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({pid: mockPid});
      expect(countersRepo.getNextPuzzleId).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      const countersRepo = (
        app as FastifyInstance & {repositories: {counters: {getNextGameId: Mock; getNextPuzzleId: Mock}}}
      ).repositories.counters;
      (countersRepo.getNextPuzzleId as Mock).mockRejectedValue(error);

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
