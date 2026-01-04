import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';

describe('Puzzle List API', () => {
  let app: FastifyInstance & {
    repositories: {
      puzzle: {
        list: Mock;
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

  describe('GET /api/puzzle_list', () => {
    it('should return puzzle list with valid query parameters', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          puzzle: {title: 'Puzzle 1'},
        },
        {
          pid: 'pid2',
          puzzle: {title: 'Puzzle 2'},
        },
      ];

      app.repositories.puzzle.list.mockResolvedValue({puzzles: mockPuzzles, total: 2});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10&sizeMini=true&sizeStandard=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('puzzles');
      expect(body.puzzles).toHaveLength(2);
      expect(body.puzzles[0]).toHaveProperty('pid');
      expect(body.puzzles[0]).toHaveProperty('content');
      expect(body.puzzles[0]).toHaveProperty('stats');
      expect(body.puzzles[0].pid).toBe('pid1');
      expect(body.puzzles[0].content).toEqual({title: 'Puzzle 1'});
      expect(body.puzzles[0].stats).toEqual({numSolves: 0});
    });

    it('should return 400 for invalid page parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=invalid&pageSize=10',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('page and pageSize should be integers');
    });

    it('should return 400 for invalid pageSize parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
    });

    it('should handle missing filter parameters', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          puzzle: {title: 'Puzzle 1'},
        },
      ];

      app.repositories.puzzle.list.mockResolvedValue({puzzles: mockPuzzles, total: 1});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      expect(app.repositories.puzzle.list).toHaveBeenCalled();
    });

    it('should return empty puzzle list response', async () => {
      app.repositories.puzzle.list.mockResolvedValue({puzzles: [], total: 0});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toEqual([]);
    });

    it('should handle nameOrTitleFilter parameter', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          puzzle: {title: 'Test Puzzle'},
        },
      ];

      app.repositories.puzzle.list.mockResolvedValue({puzzles: mockPuzzles, total: 1});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10&nameOrTitle=Test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      expect(app.repositories.puzzle.list).toHaveBeenCalled();
    });

    it('should handle page=0 correctly', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          puzzle: {title: 'Puzzle 1'},
        },
      ];

      app.repositories.puzzle.list.mockResolvedValue({puzzles: mockPuzzles, total: 1});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      // Verify offset calculation: page * pageSize = 0 * 10 = 0
      expect(app.repositories.puzzle.list).toHaveBeenCalledWith(
        expect.any(Object),
        10, // limit
        0 // offset
      );
    });

    it('should handle very large pageSize', async () => {
      const mockPuzzles = Array.from({length: 100}, (_, i) => ({
        pid: `pid${i}`,
        puzzle: {title: `Puzzle ${i}`},
      }));

      app.repositories.puzzle.list.mockResolvedValue({puzzles: mockPuzzles, total: 100});

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=1000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(100);
      expect(app.repositories.puzzle.list).toHaveBeenCalledWith(
        expect.any(Object),
        1000, // limit
        0 // offset
      );
    });

    it('should handle negative page parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=-1&pageSize=10',
      });

      // Negative numbers are still finite, so they pass the Number.isFinite check
      // The actual behavior depends on the model implementation
      expect(response.statusCode).toBeLessThan(500);
    });

    it('should handle missing page parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?pageSize=10',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
    });

    it('should handle missing pageSize parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
    });

    it('should handle errors from repository', async () => {
      const error = new Error('Database error');
      app.repositories.puzzle.list.mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
    });
  });
});
