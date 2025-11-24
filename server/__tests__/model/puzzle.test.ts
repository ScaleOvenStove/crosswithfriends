import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import * as puzzleModel from '../../model/puzzle.js';
import {pool} from '../../model/pool.js';

// Mock the database pool
vi.mock('../../model/pool.js', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

describe('Puzzle Model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPuzzle', () => {
    it('should retrieve puzzle from database', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        title: 'Test Puzzle',
        author: 'Test Author',
        solution: [['.', 'A']],
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const puzzle = await puzzleModel.getPuzzle(mockPid);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT content'), [mockPid]);
      expect(puzzle).toEqual(mockPuzzle);
    });

    it('should throw error when puzzle not found', async () => {
      const mockPid = 'nonexistent-pid';
      (pool.query as Mock).mockResolvedValue({rows: []});

      await expect(puzzleModel.getPuzzle(mockPid)).rejects.toThrow(`Puzzle ${mockPid} not found`);
    });
  });

  describe('listPuzzles', () => {
    it('should list puzzles with basic filter', async () => {
      const filter = {
        nameOrTitleFilter: '',
        sizeFilter: {Mini: false, Standard: false},
      };
      const limit = 10;
      const offset = 0;

      const mockRows = [
        {
          pid: 'pid1',
          uploaded_at: '2024-01-01',
          content: {title: 'Puzzle 1'},
          times_solved: '5',
        },
        {
          pid: 'pid2',
          uploaded_at: '2024-01-02',
          content: {title: 'Puzzle 2'},
          times_solved: '10',
        },
      ];

      (pool.query as Mock).mockResolvedValue({rows: mockRows});

      const puzzles = await puzzleModel.listPuzzles(filter, limit, offset);

      expect(puzzles).toHaveLength(2);
      expect(puzzles[0].pid).toBe('pid1');
      expect(puzzles[0].times_solved).toBe(5);
      expect(puzzles[1].pid).toBe('pid2');
      expect(puzzles[1].times_solved).toBe(10);
    });

    it('should filter by Mini puzzle size', async () => {
      const filter = {
        nameOrTitleFilter: '',
        sizeFilter: {Mini: true, Standard: false},
      };
      const limit = 10;
      const offset = 0;

      (pool.query as Mock).mockResolvedValue({rows: []});

      await puzzleModel.listPuzzles(filter, limit, offset);

      const query = (pool.query as Mock).mock.calls[0][0];
      expect(query).toContain('Mini Puzzle');
    });

    it('should filter by Standard puzzle size', async () => {
      const filter = {
        nameOrTitleFilter: '',
        sizeFilter: {Mini: false, Standard: true},
      };
      const limit = 10;
      const offset = 0;

      (pool.query as Mock).mockResolvedValue({rows: []});

      await puzzleModel.listPuzzles(filter, limit, offset);

      const query = (pool.query as Mock).mock.calls[0][0];
      expect(query).toContain('Daily Puzzle');
    });

    it('should filter by title/author search', async () => {
      const filter = {
        nameOrTitleFilter: 'test puzzle',
        sizeFilter: {Mini: false, Standard: false},
      };
      const limit = 10;
      const offset = 0;

      (pool.query as Mock).mockResolvedValue({rows: []});

      await puzzleModel.listPuzzles(filter, limit, offset);

      const queryParams = (pool.query as Mock).mock.calls[0][1];
      expect(queryParams).toContain('%test%');
      expect(queryParams).toContain('%puzzle%');
    });

    it('should handle empty search filter', async () => {
      const filter = {
        nameOrTitleFilter: '   ',
        sizeFilter: {Mini: false, Standard: false},
      };
      const limit = 10;
      const offset = 0;

      (pool.query as Mock).mockResolvedValue({rows: []});

      await puzzleModel.listPuzzles(filter, limit, offset);

      const queryParams = (pool.query as Mock).mock.calls[0][1];
      // Should not include empty search terms
      expect(queryParams.filter((p: unknown) => typeof p === 'string' && p.includes('%'))).toHaveLength(0);
    });

    it('should apply limit and offset', async () => {
      const filter = {
        nameOrTitleFilter: '',
        sizeFilter: {Mini: false, Standard: false},
      };
      const limit = 5;
      const offset = 10;

      (pool.query as Mock).mockResolvedValue({rows: []});

      await puzzleModel.listPuzzles(filter, limit, offset);

      const query = (pool.query as Mock).mock.calls[0][0];
      expect(query).toContain('LIMIT');
      expect(query).toContain('OFFSET');
    });
  });

  describe('addPuzzle', () => {
    it('should add puzzle with generated pid', async () => {
      const mockPuzzle = {
        version: '1',
        kind: ['crossword'],
        dimensions: {width: 5, height: 5},
        title: 'Test Puzzle',
        author: 'Test Author',
        solution: [['.', 'A']],
        puzzle: [[null, 1]],
        clues: {Across: [], Down: []},
      };

      (pool.query as Mock).mockResolvedValue({});

      const pid = await puzzleModel.addPuzzle(mockPuzzle, true);

      expect(pool.query).toHaveBeenCalled();
      const callArgs = (pool.query as Mock).mock.calls[0][1];
      expect(callArgs[2]).toBe(true); // isPublic
      expect(callArgs[3]).toEqual(mockPuzzle); // content
      expect(pid).toBeDefined();
      expect(pid.length).toBeGreaterThan(0);
    });

    it('should add puzzle with provided pid', async () => {
      const mockPuzzle = {
        version: '1',
        kind: ['crossword'],
        dimensions: {width: 5, height: 5},
        title: 'Test Puzzle',
        author: 'Test Author',
        solution: [['.', 'A']],
        puzzle: [[null, 1]],
        clues: {Across: [], Down: []},
      };
      const providedPid = 'custom-pid-123';

      (pool.query as Mock).mockResolvedValue({});

      const pid = await puzzleModel.addPuzzle(mockPuzzle, false, providedPid);

      expect(pid).toBe(providedPid);
      const callArgs = (pool.query as Mock).mock.calls[0][1];
      expect(callArgs[0]).toBe(providedPid);
    });

    it('should throw error for invalid puzzle data', async () => {
      const invalidPuzzle = {
        title: 'Missing required fields',
      };

      await expect(puzzleModel.addPuzzle(invalidPuzzle as never, true)).rejects.toThrow();
    });
  });

  describe('recordSolve', () => {
    it('should record a solve', async () => {
      const mockPid = 'test-pid-123';
      const mockGid = 'test-gid-456';
      const timeToSolve = 120;

      const mockClient = {
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };

      (pool.connect as Mock).mockResolvedValue(mockClient);
      (pool.query as Mock).mockResolvedValue({rows: [{count: '0'}]});

      await puzzleModel.recordSolve(mockPid, mockGid, timeToSolve);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO puzzle_solves'),
        expect.arrayContaining([mockPid, mockGid, expect.any(Number), timeToSolve])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE puzzles SET times_solved'),
        [mockPid]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should skip recording if gid already solved', async () => {
      const mockPid = 'test-pid-123';
      const mockGid = 'test-gid-456';
      const timeToSolve = 120;

      (pool.query as Mock).mockResolvedValue({rows: [{count: '1'}]});

      await puzzleModel.recordSolve(mockPid, mockGid, timeToSolve);

      // Should not connect or start transaction
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockPid = 'test-pid-123';
      const mockGid = 'test-gid-456';
      const timeToSolve = 120;

      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')), // INSERT fails
        release: vi.fn(),
      };

      (pool.connect as Mock).mockResolvedValue(mockClient);
      (pool.query as Mock).mockResolvedValue({rows: [{count: '0'}]});

      await puzzleModel.recordSolve(mockPid, mockGid, timeToSolve);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getPuzzleInfo', () => {
    it('should extract info from ipuz format', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        title: 'Test Puzzle',
        author: 'Test Author',
        copyright: '© 2024',
        notes: 'Test notes',
        solution: [['.', 'A']],
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const info = await puzzleModel.getPuzzleInfo(mockPid);

      expect(info).toEqual({
        title: 'Test Puzzle',
        author: 'Test Author',
        copyright: '© 2024',
        description: 'Test notes',
        type: 'Mini Puzzle', // <= 10 rows
      });
    });

    it('should extract info from old format', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        info: {
          title: 'Old Format Puzzle',
          author: 'Old Author',
          copyright: '© 2023',
          description: 'Old description',
          type: 'Daily Puzzle',
        },
        grid: [],
        solution: [],
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const info = await puzzleModel.getPuzzleInfo(mockPid);

      expect(info).toEqual({
        title: 'Old Format Puzzle',
        author: 'Old Author',
        copyright: '© 2023',
        description: 'Old description',
        type: 'Daily Puzzle',
      });
    });

    it('should determine type from solution size for ipuz', async () => {
      const mockPid = 'test-pid-123';
      // Mini puzzle (<= 10 rows)
      const miniPuzzle = {
        title: 'Mini',
        author: 'Author',
        solution: Array(10).fill(['.', 'A']),
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: miniPuzzle}],
      });

      let info = await puzzleModel.getPuzzleInfo(mockPid);
      expect(info.type).toBe('Mini Puzzle');

      // Daily puzzle (> 10 rows)
      const dailyPuzzle = {
        title: 'Daily',
        author: 'Author',
        solution: Array(15).fill(['.', 'A']),
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: dailyPuzzle}],
      });

      info = await puzzleModel.getPuzzleInfo(mockPid);
      expect(info.type).toBe('Daily Puzzle');
    });

    it('should handle missing optional fields', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        title: 'Test Puzzle',
        author: 'Test Author',
        solution: [['.', 'A']],
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const info = await puzzleModel.getPuzzleInfo(mockPid);

      expect(info.copyright).toBe('');
      expect(info.description).toBe('');
    });
  });
});


