import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('Record Solve API', () => {
  let app: FastifyInstance & {
    repositories: {
      puzzle: {
        recordSolve: Mock;
      };
    };
  };

  beforeAll(async () => {
    app = (await buildTestApp()) as typeof app;
    await waitForApp(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/record_solve/:pid', () => {
    it('should record a solve successfully', async () => {
      const mockPid = 'test-pid-123';
      const mockRequest = {
        gid: 'test-gid-456',
        time_to_solve: 120,
      };

      app.repositories.puzzle.recordSolve.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: `/api/record_solve/${mockPid}`,
        payload: mockRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({});
      expect(app.repositories.puzzle.recordSolve).toHaveBeenCalledWith(
        mockPid,
        mockRequest.gid,
        mockRequest.time_to_solve
      );
    });

    it('should handle errors from repository', async () => {
      const error = new Error('Failed to record solve');
      app.repositories.puzzle.recordSolve.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/record_solve/test-pid',
        payload: {
          gid: 'test-gid',
          time_to_solve: 120,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('Failed to record solve');
    });
  });
});
