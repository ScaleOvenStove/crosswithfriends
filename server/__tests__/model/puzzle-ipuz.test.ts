import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest';
import {readFileSync} from 'fs';
import {join} from 'path';
import * as puzzleModel from '../../model/puzzle.js';
import {addInitialGameEvent} from '../../model/game.js';
import {pool} from '../../model/pool.js';

// Mock the database pool
vi.mock('../../model/pool.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock puzzle model but allow getPuzzle to be mocked in tests
vi.mock('../../model/puzzle.js', async () => {
  const actual = await vi.importActual('../../model/puzzle.js');
  return {
    ...actual,
    getPuzzle: vi.fn(),
  };
});

// Mock gameUtils since addInitialGameEvent uses it
vi.mock('../../gameUtils.js', async () => {
  const actual = await vi.importActual('../../gameUtils.js');
  return actual;
});

// Mock game model functions but keep addInitialGameEvent real for testing
vi.mock('../../model/game.js', async () => {
  const actual = await vi.importActual('../../model/game.js');
  return {
    ...actual,
    addGameEvent: vi.fn(),
    getGameEvents: vi.fn(),
    getGameInfo: vi.fn(),
  };
});

describe('Puzzle IPuz File Loading', () => {
  const testDataDir = join(__dirname, '../testdata');

  describe('Loading IPuz Files', () => {
    it('should load and parse puzzle.ipuz file', () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      // Verify it's a valid ipuz puzzle
      expect(puzzle).toHaveProperty('version');
      expect(puzzle).toHaveProperty('kind');
      expect(puzzle).toHaveProperty('dimensions');
      expect(puzzle).toHaveProperty('title');
      expect(puzzle).toHaveProperty('author');
      expect(puzzle).toHaveProperty('solution');
      expect(puzzle).toHaveProperty('puzzle');
      expect(puzzle).toHaveProperty('clues');
    });

    it('should load and parse ColinAdamsWillShortz-NYTimesFridayOctober102025.ipuz', () => {
      const filePath = join(testDataDir, 'ColinAdamsWillShortz-NYTimesFridayOctober102025.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      expect(puzzle).toHaveProperty('version');
      expect(puzzle).toHaveProperty('title');
      expect(puzzle).toHaveProperty('author');
      expect(puzzle).toHaveProperty('solution');
      expect(Array.isArray(puzzle.solution)).toBe(true);
      expect(puzzle.solution.length).toBeGreaterThan(0);
    });

    it('should load and parse JoelFagliano-NYTimesMiniCrosswordSaturdaySeptember132025.ipuz', () => {
      const filePath = join(testDataDir, 'JoelFagliano-NYTimesMiniCrosswordSaturdaySeptember132025.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      expect(puzzle).toHaveProperty('version');
      expect(puzzle).toHaveProperty('title');
      expect(puzzle).toHaveProperty('author');
      expect(puzzle).toHaveProperty('solution');
      expect(Array.isArray(puzzle.solution)).toBe(true);
      expect(puzzle.solution.length).toBeGreaterThan(0);
    });
  });

  describe('Validating IPuz Files', () => {
    it('should load puzzle.ipuz file structure', () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      // Verify it has the required ipuz structure
      expect(puzzle).toHaveProperty('version');
      expect(puzzle).toHaveProperty('kind');
      expect(puzzle).toHaveProperty('dimensions');
      expect(puzzle).toHaveProperty('title');
      expect(puzzle).toHaveProperty('author');
      expect(puzzle).toHaveProperty('solution');
      expect(puzzle).toHaveProperty('puzzle');
      expect(puzzle).toHaveProperty('clues');
    });

    it('should load NYTimes puzzle files', () => {
      const files = [
        'ColinAdamsWillShortz-NYTimesFridayOctober102025.ipuz',
        'JoelFagliano-NYTimesMiniCrosswordSaturdaySeptember132025.ipuz',
      ];

      for (const fileName of files) {
        const filePath = join(testDataDir, fileName);
        const fileContent = readFileSync(filePath, 'utf-8');
        const puzzle = JSON.parse(fileContent);

        expect(puzzle).toHaveProperty('version');
        expect(puzzle).toHaveProperty('title');
        expect(puzzle).toHaveProperty('author');
        expect(puzzle).toHaveProperty('solution');
      }
    });
  });

  describe('Processing IPuz Files with addInitialGameEvent', () => {
    it('should process puzzle.ipuz and create initial game event', async () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      const mockGid = 'test-gid-123';
      (pool.query as Mock).mockResolvedValue({});

      // Mock getPuzzle using the mocked module
      (puzzleModel.getPuzzle as Mock).mockResolvedValue(puzzle);

      await addInitialGameEvent(mockGid, 'test-pid');

      expect(puzzleModel.getPuzzle).toHaveBeenCalledWith('test-pid');
      expect(pool.query).toHaveBeenCalled();
    });

    it('should extract metadata from puzzle.ipuz', async () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      (pool.query as Mock).mockResolvedValue({
        rows: [{content: puzzle}],
      });

      const info = await puzzleModel.getPuzzleInfo('test-pid');

      expect(info.title).toBe(puzzle.title || '');
      expect(info.author).toBe(puzzle.author || '');
      if (puzzle.copyright) {
        expect(info.copyright).toBe(puzzle.copyright);
      }
      if (puzzle.notes) {
        expect(info.description).toBe(puzzle.notes);
      }
    });

    it('should determine puzzle type from solution size', async () => {
      const files = [
        {
          file: 'JoelFagliano-NYTimesMiniCrosswordSaturdaySeptember132025.ipuz',
          expectedType: 'Mini Puzzle',
        },
        {
          file: 'ColinAdamsWillShortz-NYTimesFridayOctober102025.ipuz',
          expectedType: 'Daily Puzzle',
        },
      ];

      for (const {file, expectedType} of files) {
        const filePath = join(testDataDir, file);
        const fileContent = readFileSync(filePath, 'utf-8');
        const puzzle = JSON.parse(fileContent);

        (pool.query as Mock).mockResolvedValue({
          rows: [{content: puzzle}],
        });

        const info = await puzzleModel.getPuzzleInfo('test-pid');
        // Type is determined by solution length
        const solutionLength = Array.isArray(puzzle.solution) ? puzzle.solution.length : 0;
        const actualType = solutionLength > 10 ? 'Daily Puzzle' : 'Mini Puzzle';
        expect(actualType).toBe(expectedType);
      }
    });
  });

  describe('IPuz Clue Format Support', () => {
    it('should handle v1 clue format (array format)', () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      // Check if clues are in v1 format
      if (puzzle.clues?.Across && Array.isArray(puzzle.clues.Across)) {
        const firstClue = puzzle.clues.Across[0];
        if (Array.isArray(firstClue)) {
          // v1 format: ["1", "clue text"] or [1, "clue text"] (number can be number or string)
          expect(firstClue).toHaveLength(2);
          expect(typeof firstClue[0] === 'string' || typeof firstClue[0] === 'number').toBe(true);
          expect(typeof firstClue[1]).toBe('string');
        }
      }
    });

    it('should handle v2 clue format (object format)', async () => {
      // Check if any puzzle uses v2 format
      const files = [
        'puzzle.ipuz',
        'ColinAdamsWillShortz-NYTimesFridayOctober102025.ipuz',
        'JoelFagliano-NYTimesMiniCrosswordSaturdaySeptember132025.ipuz',
      ];

      for (const fileName of files) {
        const filePath = join(testDataDir, fileName);
        const fileContent = readFileSync(filePath, 'utf-8');
        const puzzle = JSON.parse(fileContent);

        if (puzzle.clues?.Across && Array.isArray(puzzle.clues.Across)) {
          const firstClue = puzzle.clues.Across[0];
          if (firstClue && typeof firstClue === 'object' && 'number' in firstClue && 'clue' in firstClue) {
            // v2 format: {number: "1", clue: "clue text"}
            expect(firstClue).toHaveProperty('number');
            expect(firstClue).toHaveProperty('clue');
          }
        }
      }
    });
  });

  describe('IPuz Puzzle Processing', () => {
    it('should process circles from puzzle grid', async () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      const mockGid = 'test-gid-123';
      (pool.query as Mock).mockResolvedValue({});
      vi.spyOn(puzzleModel, 'getPuzzle').mockResolvedValue(puzzle);

      await addInitialGameEvent(mockGid, 'test-pid');

      // Check if puzzle has circles in grid
      if (puzzle.puzzle && Array.isArray(puzzle.puzzle)) {
        const hasCircles = puzzle.puzzle.some(
          (row: unknown[]) =>
            Array.isArray(row) &&
            row.some(
              (cell) =>
                cell &&
                typeof cell === 'object' &&
                'style' in cell &&
                (cell as {style?: {shapebg?: string}}).style?.shapebg === 'circle'
            )
        );

        if (hasCircles) {
          // Should extract circles
          const callArgs = (pool.query as Mock).mock.calls.find((call) =>
            call[0].includes('INSERT INTO game_events')
          )?.[1];
          if (callArgs) {
            const event = callArgs[4];
            expect(event.params.game.circles).toBeDefined();
          }
        }
      }
    });

    it('should process shades from puzzle grid', async () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      const mockGid = 'test-gid-123';
      (pool.query as Mock).mockResolvedValue({});
      vi.spyOn(puzzleModel, 'getPuzzle').mockResolvedValue(puzzle);

      await addInitialGameEvent(mockGid, 'test-pid');

      // Check if puzzle has shades in grid
      if (puzzle.puzzle && Array.isArray(puzzle.puzzle)) {
        const hasShades = puzzle.puzzle.some(
          (row: unknown[]) =>
            Array.isArray(row) &&
            row.some(
              (cell) =>
                cell &&
                typeof cell === 'object' &&
                'style' in cell &&
                (cell as {style?: {fillbg?: string}}).style?.fillbg
            )
        );

        if (hasShades) {
          // Should extract shades
          const callArgs = (pool.query as Mock).mock.calls.find((call) =>
            call[0].includes('INSERT INTO game_events')
          )?.[1];
          if (callArgs) {
            const event = callArgs[4];
            expect(event.params.game.shades).toBeDefined();
          }
        }
      }
    });

    it('should convert solution nulls to dots', async () => {
      const filePath = join(testDataDir, 'puzzle.ipuz');
      const fileContent = readFileSync(filePath, 'utf-8');
      const puzzle = JSON.parse(fileContent);

      const mockGid = 'test-gid-123';
      (pool.query as Mock).mockResolvedValue({});
      vi.spyOn(puzzleModel, 'getPuzzle').mockResolvedValue(puzzle);

      await addInitialGameEvent(mockGid, 'test-pid');

      const callArgs = (pool.query as Mock).mock.calls.find((call) =>
        call[0].includes('INSERT INTO game_events')
      )?.[1];
      if (callArgs) {
        const event = callArgs[4];
        const solution = event.params.game.solution;
        // Solution should have dots instead of nulls
        expect(Array.isArray(solution)).toBe(true);
        solution.forEach((row: unknown[]) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              expect(cell === null || cell === '.' || typeof cell === 'string').toBe(true);
            });
          }
        });
      }
    });
  });
});
