import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('Puzzle API', () => {
  let app: FastifyInstance & {
    repositories: {
      puzzle: {
        create: Mock;
        findById: Mock;
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

  describe('POST /api/puzzle', () => {
    it('should create a puzzle and return pid', async () => {
      const mockPid = 'test-pid-789';
      const mockPuzzle = {title: 'Test Puzzle', clues: {Across: [], Down: []}};
      const mockRequest = {
        puzzle: mockPuzzle,
        isPublic: true,
        pid: undefined,
      };

      app.repositories.puzzle.create.mockResolvedValue(mockPid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/puzzle',
        payload: mockRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({pid: mockPid});
      expect(app.repositories.puzzle.create).toHaveBeenCalledWith('', mockPuzzle, true);
    });

    it('should handle errors from repository', async () => {
      const error = new Error('Invalid puzzle data');
      app.repositories.puzzle.create.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/puzzle',
        payload: {
          puzzle: {clues: {Across: [], Down: []}},
          isPublic: false,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('Invalid puzzle data');
    });
  });

  describe('GET /api/puzzle/:pid', () => {
    it('should return puzzle by id', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        title: 'Test Puzzle',
        author: 'Test Author',
        clues: {Across: [], Down: []},
        grid: [],
      };

      app.repositories.puzzle.findById.mockResolvedValue(mockPuzzle);

      const response = await app.inject({
        method: 'GET',
        url: `/api/puzzle/${mockPid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual(mockPuzzle);
      expect(app.repositories.puzzle.findById).toHaveBeenCalledWith(mockPid);
    });

    it('should return 404 when puzzle not found', async () => {
      const mockPid = 'nonexistent-pid';
      const error = new Error('Puzzle not found');
      app.repositories.puzzle.findById.mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: `/api/puzzle/${mockPid}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Puzzle not found');
    });

    it('should handle errors from repository', async () => {
      const mockPid = 'test-pid';
      const error = new Error('Database error');
      app.repositories.puzzle.findById.mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: `/api/puzzle/${mockPid}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Puzzle not found');
    });
  });
});
