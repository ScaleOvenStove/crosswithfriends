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
    it('should retrieve and return ipuz puzzle unchanged', async () => {
      const mockPid = 'test-pid-123';
      const mockPuzzle = {
        version: 'http://ipuz.org/v2',
        kind: ['http://ipuz.org/crossword#1'],
        dimensions: {width: 2, height: 1},
        title: 'Test Puzzle',
        author: 'Test Author',
        solution: [['.', 'A']],
        puzzle: [['#', 1]],
        clues: {Across: [], Down: []},
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const puzzle = await puzzleModel.getPuzzle(mockPid);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT content'), [mockPid]);
      expect(puzzle).toEqual(mockPuzzle);
    });

    it('should convert old format puzzle to ipuz format', async () => {
      const mockPid = 'test-pid-old';
      const oldFormatPuzzle = {
        grid: [
          ['.', 'C', 'A', 'T'],
          ['D', 'O', 'G', '.'],
        ],
        info: {
          title: 'Old Puzzle',
          author: 'Old Author',
          copyright: '© 2023',
          description: 'Old description',
          type: 'Mini Puzzle',
        },
        clues: {
          across: ['', '1', 'Feline pet', '4', 'Canine pet'],
          down: ['', '2', 'Letter A', '3', 'Letter T'],
        },
        circles: [1, 5],
        shades: [],
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: oldFormatPuzzle}],
      });

      const puzzle = await puzzleModel.getPuzzle(mockPid);

      // Should be converted to ipuz format
      expect(puzzle.version).toBe('http://ipuz.org/v2');
      expect(puzzle.kind).toEqual(['http://ipuz.org/crossword#1']);
      expect(puzzle.dimensions).toEqual({width: 4, height: 2});
      expect(puzzle.title).toBe('Old Puzzle');
      expect(puzzle.author).toBe('Old Author');
      expect(puzzle.solution).toEqual([
        ['.', 'C', 'A', 'T'],
        ['D', 'O', 'G', '.'],
      ]);
      // Clues should be in v2 object format
      expect(puzzle.clues?.Across).toEqual([
        {number: '1', clue: 'Feline pet'},
        {number: '4', clue: 'Canine pet'},
      ]);
      expect(puzzle.clues?.Down).toEqual([
        {number: '2', clue: 'Letter A'},
        {number: '3', clue: 'Letter T'},
      ]);
      // Puzzle grid should have numbers assigned
      expect(puzzle.puzzle).toBeDefined();
    });

    it('should throw error when puzzle not found', async () => {
      const mockPid = 'nonexistent-pid';
      (pool.query as Mock).mockResolvedValue({rows: []});

      await expect(puzzleModel.getPuzzle(mockPid)).rejects.toThrow(`Puzzle ${mockPid} not found`);
    });
  });

  describe('convertOldFormatToIpuz', () => {
    it('should return ipuz puzzle unchanged', () => {
      const ipuzPuzzle = {
        version: 'http://ipuz.org/v2',
        kind: ['http://ipuz.org/crossword#1'],
        dimensions: {width: 3, height: 3},
        title: 'Test',
        author: 'Author',
        solution: [['A', 'B', 'C']],
        puzzle: [[1, 2, 3]],
        clues: {Across: [], Down: []},
      };

      const result = puzzleModel.convertOldFormatToIpuz(ipuzPuzzle);
      expect(result).toEqual(ipuzPuzzle);
    });

    it('should convert old format with grid to ipuz', () => {
      const oldPuzzle = {
        grid: [
          ['C', 'A', 'T'],
          ['.', '.', '.'],
          ['D', 'O', 'G'],
        ],
        info: {
          title: 'Animals',
          author: 'Tester',
          copyright: '© 2024',
          description: 'Animal words',
        },
        clues: {
          across: ['', '1', 'Meow', '3', 'Woof'],
          down: ['', '1', 'Letter C', '2', 'Letter A'],
        },
        circles: [0, 1],
        shades: [6],
      };

      const result = puzzleModel.convertOldFormatToIpuz(oldPuzzle as any);

      expect(result.version).toBe('http://ipuz.org/v2');
      expect(result.kind).toEqual(['http://ipuz.org/crossword#1']);
      expect(result.dimensions).toEqual({width: 3, height: 3});
      expect(result.title).toBe('Animals');
      expect(result.author).toBe('Tester');
      expect(result.copyright).toBe('© 2024');
      expect(result.notes).toBe('Animal words');
      expect(result.solution).toEqual([
        ['C', 'A', 'T'],
        ['.', '.', '.'],
        ['D', 'O', 'G'],
      ]);
      // Clues should be in v2 object format
      expect(result.clues?.Across).toEqual([
        {number: '1', clue: 'Meow'},
        {number: '3', clue: 'Woof'},
      ]);
      expect(result.clues?.Down).toEqual([
        {number: '1', clue: 'Letter C'},
        {number: '2', clue: 'Letter A'},
      ]);

      // Check puzzle grid structure
      expect(result.puzzle).toBeDefined();
      expect(result.puzzle?.length).toBe(3);

      // First row: position 0 has circle and number 1, position 1 has circle but no number (cell 0)
      expect(result.puzzle?.[0]?.[0]).toEqual({cell: 1, style: {shapebg: 'circle'}});
      expect(result.puzzle?.[0]?.[1]).toEqual({cell: 0, style: {shapebg: 'circle'}});

      // Black cells should be '#'
      expect(result.puzzle?.[1]?.[0]).toBe('#');
      expect(result.puzzle?.[1]?.[1]).toBe('#');
      expect(result.puzzle?.[1]?.[2]).toBe('#');

      // Third row should have number 2 (shade at index 6, sequential numbering)
      // [0][0] gets 1 (CAT across), [2][0] gets 2 (DOG across)
      expect(result.puzzle?.[2]?.[0]).toEqual({cell: 2, style: {fillbg: 'gray'}});
    });

    it('should handle old format without circles or shades', () => {
      const oldPuzzle = {
        grid: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        info: {
          title: 'Simple',
          author: 'Me',
        },
        clues: {
          across: ['', '1', 'AB', '2', 'CD'],
          down: ['', '1', 'AC', '2', 'BD'],
        },
      };

      const result = puzzleModel.convertOldFormatToIpuz(oldPuzzle as any);

      expect(result.solution).toEqual([
        ['A', 'B'],
        ['C', 'D'],
      ]);

      // Puzzle grid should not have circle/shade styles
      // [0][0] gets 1 (AB across, AC down), [0][1] gets 2 (BD down), [1][0] gets 3 (CD across)
      expect(result.puzzle?.[0]?.[0]).toBe(1);
      expect(result.puzzle?.[1]?.[0]).toBe(3);
    });

    it('should throw error for empty grid', () => {
      const oldPuzzle = {
        grid: [],
        info: {title: 'Empty', author: 'None'},
        clues: {across: [], down: []},
      };

      expect(() => puzzleModel.convertOldFormatToIpuz(oldPuzzle as any)).toThrow(
        'Old format puzzle has empty grid'
      );
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
        grid: [
          ['A', 'B'],
          ['C', 'D'],
        ], // Need valid grid for conversion
        clues: {
          across: ['', '1', 'AB', '2', 'CD'],
          down: ['', '1', 'AC', '2', 'BD'],
        },
      };

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: mockPuzzle}],
      });

      const info = await puzzleModel.getPuzzleInfo(mockPid);

      // Type is determined from puzzle size, not from info.type
      // The grid is 2x2, which would be classified as "Mini Puzzle"
      expect(info).toEqual({
        title: 'Old Format Puzzle',
        author: 'Old Author',
        copyright: '© 2023',
        description: 'Old description',
        type: 'Mini Puzzle',
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
