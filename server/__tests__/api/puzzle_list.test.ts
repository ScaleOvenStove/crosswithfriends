import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';
import * as puzzleModel from '../../model/puzzle.js';

// Mock the model - use importActual to keep real implementations
vi.mock('../../model/puzzle.js', async () => {
  const actual = await vi.importActual<typeof import('../../model/puzzle.js')>('../../model/puzzle.js');
  return {
    ...actual,
    convertOldFormatToIpuz: vi.fn((content: any) => content),
    listPuzzles: vi.fn(),
  };
});

describe('Puzzle List API', () => {
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
    // convertOldFormatToIpuz is already mocked in vi.mock above
    // Reset it to return content as-is for each test
    (puzzleModel.convertOldFormatToIpuz as Mock).mockImplementation((content: any) => content);
  });

  describe('GET /api/puzzle_list', () => {
    it('should return puzzle list with valid query parameters', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          content: {title: 'Puzzle 1'},
          times_solved: 10,
        },
        {
          pid: 'pid2',
          content: {title: 'Puzzle 2'},
          times_solved: 5,
        },
      ];

      (puzzleModel.listPuzzles as Mock).mockResolvedValue(mockPuzzles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10&sizeMini=true&sizeStandard=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('puzzles');
      expect(body.puzzles).toHaveLength(2);
      // Verify the structure - the mock should ensure convertOldFormatToIpuz returns content as-is
      expect(body.puzzles[0]).toBeDefined();
      expect(typeof body.puzzles[0]).toBe('object');
      // Check if the mock is working - if not, the object might be empty
      if (Object.keys(body.puzzles[0]).length === 0) {
        // Mock might not be working - check if convertOldFormatToIpuz was called
        expect(puzzleModel.convertOldFormatToIpuz).toHaveBeenCalled();
      }
      expect(body.puzzles[0]).toHaveProperty('pid');
      expect(body.puzzles[0]).toHaveProperty('content');
      expect(body.puzzles[0]).toHaveProperty('stats');
      expect(body.puzzles[0].pid).toBe('pid1');
      expect(body.puzzles[0].content).toEqual({title: 'Puzzle 1'});
      expect(body.puzzles[0].stats).toEqual({numSolves: 10});
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
          content: {title: 'Puzzle 1'},
          times_solved: 10,
        },
      ];

      (puzzleModel.listPuzzles as Mock).mockResolvedValue(mockPuzzles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      // Verify listPuzzles was called with default filters
      expect(puzzleModel.listPuzzles).toHaveBeenCalled();
    });

    it('should return empty puzzle list response', async () => {
      (puzzleModel.listPuzzles as Mock).mockResolvedValue([]);

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
          content: {title: 'Test Puzzle'},
          times_solved: 5,
        },
      ];

      (puzzleModel.listPuzzles as Mock).mockResolvedValue(mockPuzzles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10&nameOrTitle=Test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      expect(puzzleModel.listPuzzles).toHaveBeenCalled();
    });

    it('should handle page=0 correctly', async () => {
      const mockPuzzles = [
        {
          pid: 'pid1',
          content: {title: 'Puzzle 1'},
          times_solved: 10,
        },
      ];

      (puzzleModel.listPuzzles as Mock).mockResolvedValue(mockPuzzles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(1);
      // Verify offset calculation: page * pageSize = 0 * 10 = 0
      expect(puzzleModel.listPuzzles).toHaveBeenCalledWith(
        expect.any(Object),
        10, // limit
        0 // offset
      );
    });

    it('should handle very large pageSize', async () => {
      const mockPuzzles = Array.from({length: 100}, (_, i) => ({
        pid: `pid${i}`,
        content: {title: `Puzzle ${i}`},
        times_solved: i,
      }));

      (puzzleModel.listPuzzles as Mock).mockResolvedValue(mockPuzzles);

      const response = await app.inject({
        method: 'GET',
        url: '/api/puzzle_list?page=0&pageSize=1000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.puzzles).toHaveLength(100);
      expect(puzzleModel.listPuzzles).toHaveBeenCalledWith(
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

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      (puzzleModel.listPuzzles as Mock).mockRejectedValue(error);

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
