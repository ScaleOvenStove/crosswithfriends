import {describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock} from 'vitest';
import {buildTestApp, closeApp, waitForApp} from '../helpers.js';
import type {FastifyInstance} from 'fastify';
import * as gameModel from '../../model/game.js';
import * as puzzleSolveModel from '../../model/puzzle_solve.js';
import * as puzzleModel from '../../model/puzzle.js';

// Mock the models
vi.mock('../../model/game.js');
vi.mock('../../model/puzzle_solve.js');
vi.mock('../../model/puzzle');

describe('Game API', () => {
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

  describe('POST /api/game', () => {
    it('should create a game and return gid', async () => {
      const mockGid = 'test-gid-123';
      const mockRequest = {
        gid: mockGid,
        pid: 'test-pid-456',
      };

      (gameModel.addInitialGameEvent as Mock).mockResolvedValue(mockGid);

      const response = await app.inject({
        method: 'POST',
        url: '/api/game',
        payload: mockRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({gid: mockGid});
      expect(gameModel.addInitialGameEvent).toHaveBeenCalledWith(mockGid, 'test-pid-456');
    });

    it('should handle errors from model', async () => {
      const error = new Error('Failed to create game');
      (gameModel.addInitialGameEvent as Mock).mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/game',
        payload: {
          gid: 'test-gid',
          pid: 'test-pid',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
    });
  });

  describe('GET /api/game/:gid', () => {
    it('should return game information', async () => {
      const mockGid = 'test-gid-123';
      const mockPuzzleSolves = [
        {
          gid: mockGid,
          pid: 'test-pid',
          title: 'Test Puzzle',
          time_taken_to_solve: 120,
          size: '15x15',
        },
      ];
      const mockPuzzleInfo = {
        author: 'Test Author',
        title: 'Test Puzzle',
        description: 'Test Description',
      };

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);
      (puzzleModel.getPuzzleInfo as Mock).mockResolvedValue(mockPuzzleInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/game/${mockGid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gid).toBe(mockGid);
      expect(body.title).toBe('Test Puzzle');
      expect(body.author).toBe('Test Author');
      expect(body.duration).toBe(120);
      expect(body.size).toBe('15x15');
    });

    it('should return "Unknown" author when puzzle info is missing author', async () => {
      const mockGid = 'test-gid-123';
      const mockPuzzleSolves = [
        {
          gid: mockGid,
          pid: 'test-pid',
          title: 'Test Puzzle',
          time_taken_to_solve: 120,
          size: '15x15',
        },
      ];
      const mockPuzzleInfo = {
        title: 'Test Puzzle',
        description: 'Test Description',
        // author is missing
      };

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);
      (puzzleModel.getPuzzleInfo as Mock).mockResolvedValue(mockPuzzleInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/game/${mockGid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.author).toBe('Unknown');
    });

    it('should return "Unknown" author when puzzle info is null', async () => {
      const mockGid = 'test-gid-123';
      const mockPuzzleSolves = [
        {
          gid: mockGid,
          pid: 'test-pid',
          title: 'Test Puzzle',
          time_taken_to_solve: 120,
          size: '15x15',
        },
      ];

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);
      (puzzleModel.getPuzzleInfo as Mock).mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/game/${mockGid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.author).toBe('Unknown');
    });

    it('should verify all response fields are present', async () => {
      const mockGid = 'test-gid-123';
      const mockPuzzleSolves = [
        {
          gid: mockGid,
          pid: 'test-pid',
          title: 'Test Puzzle',
          time_taken_to_solve: 120,
          size: '15x15',
        },
      ];
      const mockPuzzleInfo = {
        author: 'Test Author',
        title: 'Test Puzzle',
        description: 'Test Description',
      };

      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue(mockPuzzleSolves);
      (puzzleModel.getPuzzleInfo as Mock).mockResolvedValue(mockPuzzleInfo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/game/${mockGid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Verify all required fields are present
      expect(body).toHaveProperty('gid');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('author');
      expect(body).toHaveProperty('duration');
      expect(body).toHaveProperty('size');
      // Verify no extra fields
      expect(Object.keys(body).length).toBe(5);
    });

    it('should return 404 when game not found', async () => {
      (puzzleSolveModel.getPuzzleSolves as Mock).mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/game/nonexistent-gid',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.message).toBe('Game not found');
    });

    it('should handle errors from model', async () => {
      const error = new Error('Database error');
      (puzzleSolveModel.getPuzzleSolves as Mock).mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: '/api/game/test-gid',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
    });
  });
});
