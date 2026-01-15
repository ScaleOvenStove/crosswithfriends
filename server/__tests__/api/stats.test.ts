import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';
import type {AppInstance} from '../../types/fastify.js';
import * as puzzleSolveModel from '../../model/puzzle_solve.js';
import type {SolvedPuzzleType} from '../../model/puzzle_solve.js';
import * as statsApi from '../../api/stats.js';

// Mock the model
vi.mock('../../model/puzzle_solve.js');

describe('Stats API', () => {
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
    // Ensure computePuzzleStats uses the real implementation (it's exported from stats.ts)
    // The function should work correctly with the test data
  });

  describe('POST /api/stats', () => {
    it('should return puzzle stats for valid gids', async () => {
      const db = (app as AppInstance).db;
      const mockGids = ['gid1', 'gid2'];
      const mockPuzzleSolves: SolvedPuzzleType[] = [
        {
          gid: 'gid1',
          pid: 'pid1',
          title: 'Puzzle 1',
          size: '15x15',
          time_taken_to_solve: 120,
          revealed_squares_count: 50,
          checked_squares_count: 100,
          solved_time: new Date('2024-01-01T00:00:00Z'),
        },
        {
          gid: 'gid2',
          pid: 'pid2',
          title: 'Puzzle 2',
          size: '15x15',
          time_taken_to_solve: 180,
          revealed_squares_count: 60,
          checked_squares_count: 120,
          solved_time: new Date('2024-01-02T00:00:00Z'),
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: mockGids},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('stats');
      expect(body).toHaveProperty('history');
      expect(body.stats).toBeInstanceOf(Array);
      expect(body.history).toBeInstanceOf(Array);
      expect(puzzleSolveModel.getPuzzleSolves).toHaveBeenCalledWith(db, mockGids);
    });

    it('should return stats for empty gids array', async () => {
      const mockPuzzleSolves: SolvedPuzzleType[] = [];
      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: []},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toEqual([]);
      expect(body.history).toEqual([]);
    });

    it('should return stats for single gid', async () => {
      const mockGids = ['gid1'];
      const mockPuzzleSolves: SolvedPuzzleType[] = [
        {
          gid: 'gid1',
          pid: 'pid1',
          title: 'Single Puzzle',
          size: '21x21',
          time_taken_to_solve: 300,
          revealed_squares_count: 100,
          checked_squares_count: 200,
          solved_time: new Date('2024-01-15T00:00:00Z'),
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: mockGids},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Verify getPuzzleSolves was called with correct arguments
      const db = (app as AppInstance).db;
      expect(puzzleSolveModel.getPuzzleSolves).toHaveBeenCalledWith(db, mockGids);
      expect(body.stats).toHaveLength(1);
      // If stats[0] is empty, the computePuzzleStats function might not be working correctly
      // or the mock data isn't in the right format
      expect(body.stats[0]).toBeDefined();
      expect(typeof body.stats[0]).toBe('object');
      expect(body.stats[0]).toMatchObject({
        size: '21x21',
        nPuzzlesSolved: 1,
        avgSolveTime: 300,
        bestSolveTime: 300,
        bestSolveTimeGameId: 'gid1',
        avgCheckedSquareCount: 200,
        avgRevealedSquareCount: 100,
      });
    });

    it('should compute stats with different puzzle sizes', async () => {
      const mockGids = ['gid1', 'gid2', 'gid3'];
      const mockPuzzleSolves: SolvedPuzzleType[] = [
        {
          gid: 'gid1',
          pid: 'pid1',
          title: 'Mini Puzzle',
          size: '5x5',
          time_taken_to_solve: 60,
          revealed_squares_count: 10,
          checked_squares_count: 20,
          solved_time: new Date('2024-01-01T00:00:00Z'),
        },
        {
          gid: 'gid2',
          pid: 'pid2',
          title: 'Standard Puzzle',
          size: '15x15',
          time_taken_to_solve: 120,
          revealed_squares_count: 50,
          checked_squares_count: 100,
          solved_time: new Date('2024-01-02T00:00:00Z'),
        },
        {
          gid: 'gid3',
          pid: 'pid3',
          title: 'Large Puzzle',
          size: '21x21',
          time_taken_to_solve: 300,
          revealed_squares_count: 150,
          checked_squares_count: 300,
          solved_time: new Date('2024-01-03T00:00:00Z'),
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: mockGids},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toHaveLength(3);
      // Stats should be sorted by size
      expect(body.stats[0].size).toBe('15x15');
      expect(body.stats[1].size).toBe('21x21');
      expect(body.stats[2].size).toBe('5x5');
    });

    it('should handle stats with zero solves', async () => {
      const mockPuzzleSolves: SolvedPuzzleType[] = [];
      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: ['nonexistent']},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toEqual([]);
      expect(body.history).toEqual([]);
    });

    it('should compute average stats correctly for multiple puzzles of same size', async () => {
      const mockGids = ['gid1', 'gid2', 'gid3'];
      const mockPuzzleSolves: SolvedPuzzleType[] = [
        {
          gid: 'gid1',
          pid: 'pid1',
          title: 'Puzzle 1',
          size: '15x15',
          time_taken_to_solve: 100,
          revealed_squares_count: 50,
          checked_squares_count: 100,
          solved_time: new Date('2024-01-01T00:00:00Z'),
        },
        {
          gid: 'gid2',
          pid: 'pid2',
          title: 'Puzzle 2',
          size: '15x15',
          time_taken_to_solve: 200,
          revealed_squares_count: 60,
          checked_squares_count: 120,
          solved_time: new Date('2024-01-02T00:00:00Z'),
        },
        {
          gid: 'gid3',
          pid: 'pid3',
          title: 'Puzzle 3',
          size: '15x15',
          time_taken_to_solve: 300,
          revealed_squares_count: 70,
          checked_squares_count: 140,
          solved_time: new Date('2024-01-03T00:00:00Z'),
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: mockGids},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.stats).toHaveLength(1);
      expect(body.stats[0].size).toBe('15x15');
      expect(body.stats[0].nPuzzlesSolved).toBe(3);
      expect(body.stats[0].avgSolveTime).toBe(200); // (100 + 200 + 300) / 3
      expect(body.stats[0].bestSolveTime).toBe(100); // minimum
      expect(body.stats[0].bestSolveTimeGameId).toBe('gid1');
      expect(body.stats[0].avgRevealedSquareCount).toBe(60); // (50 + 60 + 70) / 3
      expect(body.stats[0].avgCheckedSquareCount).toBe(120); // (100 + 120 + 140) / 3
    });

    it('should return 400 for invalid gids', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: 'not-an-array'},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      // Fastify schema validation catches this before handler validation
      expect(body.message).toMatch(/validation|invalid/i);
    });

    it('should return 400 for non-string gids', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: [123, 456]},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(400);
      // Fastify schema validation catches this before handler validation
      expect(body.message).toMatch(/validation|invalid/i);
    });

    it('should format history dates correctly', async () => {
      const mockGids = ['gid1'];
      const mockPuzzleSolves: SolvedPuzzleType[] = [
        {
          gid: 'gid1',
          pid: 'pid1',
          title: 'Test Puzzle',
          size: '15x15',
          time_taken_to_solve: 120,
          revealed_squares_count: 50,
          checked_squares_count: 100,
          solved_time: new Date('2024-01-15T00:00:00Z'),
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: mockGids},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.history).toHaveLength(1);
      expect(body.history[0].dateSolved).toBe('2024-01-15');
      expect(body.history[0]).toMatchObject({
        puzzleId: 'pid1',
        gameId: 'gid1',
        title: 'Test Puzzle',
        size: '15x15',
        solveTime: 120,
        checkedSquareCount: 100,
        revealedSquareCount: 50,
      });
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      (puzzleSolveModel.getPuzzleSolves as Mock).mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/stats',
        payload: {gids: ['gid1']},
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
    });
  });
});
