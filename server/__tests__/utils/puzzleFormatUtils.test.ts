import {describe, it, expect} from 'vitest';
import {
  extractDimensions,
  extractVersion,
  extractKind,
  extractNormalizedData,
  extractMetadata,
  getPuzzleTypeFromDimensions,
  normalizeClues,
  type OldPuzzleFormat,
} from '../../utils/puzzleFormatUtils.js';
import type {PuzzleJson} from '@crosswithfriends/shared/types';

describe('puzzleFormatUtils', () => {
  describe('extractDimensions', () => {
    it('should extract dimensions from ipuz dimensions field', () => {
      const puzzle = {
        dimensions: {width: 15, height: 15},
        solution: [],
      } as unknown as PuzzleJson;

      const result = extractDimensions(puzzle);
      expect(result).toEqual({width: 15, height: 15});
    });

    it('should calculate dimensions from solution array', () => {
      const puzzle = {
        solution: [
          ['A', 'B', 'C'],
          ['D', 'E', 'F'],
        ],
      } as PuzzleJson;

      const result = extractDimensions(puzzle);
      expect(result).toEqual({width: 3, height: 2});
    });

    it('should calculate dimensions from puzzle grid when solution is missing', () => {
      const puzzle = {
        puzzle: [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
        ],
      } as unknown as PuzzleJson;

      const result = extractDimensions(puzzle);
      expect(result).toEqual({width: 4, height: 3});
    });

    it('should calculate dimensions from old format grid', () => {
      const oldPuzzle: OldPuzzleFormat = {
        grid: [
          ['A', 'B'],
          ['C', 'D'],
          ['E', 'F'],
        ],
        info: {title: 'Test'},
      };

      const result = extractDimensions(oldPuzzle as unknown as PuzzleJson);
      expect(result).toEqual({width: 2, height: 3});
    });

    it('should return 0,0 when dimensions cannot be determined', () => {
      const puzzle = {} as PuzzleJson;
      const result = extractDimensions(puzzle);
      expect(result).toEqual({width: 0, height: 0});
    });
  });

  describe('extractVersion', () => {
    it('should extract version from puzzle', () => {
      const puzzle = {
        version: 'http://ipuz.org/v2',
      } as PuzzleJson;

      const result = extractVersion(puzzle);
      expect(result).toBe('http://ipuz.org/v2');
    });

    it('should return default version when not present', () => {
      const puzzle = {} as PuzzleJson;
      const result = extractVersion(puzzle);
      expect(result).toBe('http://ipuz.org/v1');
    });
  });

  describe('extractKind', () => {
    it('should extract kind array from puzzle', () => {
      const puzzle = {
        kind: ['http://ipuz.org/crossword#1', 'http://ipuz.org/crossword#2'],
      } as PuzzleJson;

      const result = extractKind(puzzle);
      expect(result).toEqual(['http://ipuz.org/crossword#1', 'http://ipuz.org/crossword#2']);
    });

    it('should return default kind when not present', () => {
      const puzzle = {} as PuzzleJson;
      const result = extractKind(puzzle);
      expect(result).toEqual(['http://ipuz.org/crossword#1']);
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from ipuz format', () => {
      const puzzle = {
        title: 'Test Title',
        author: 'Test Author',
        copyright: '© 2024',
        notes: 'Some notes',
        solution: Array(5).fill(['A', 'B']),
      } as PuzzleJson;

      const result = extractMetadata(puzzle);
      expect(result).toEqual({
        title: 'Test Title',
        author: 'Test Author',
        copyright: '© 2024',
        description: 'Some notes',
        type: 'Mini Puzzle',
      });
    });

    it('should extract metadata from old format', () => {
      const oldPuzzle: OldPuzzleFormat = {
        grid: [['A']],
        info: {
          title: 'Old Title',
          author: 'Old Author',
          copyright: '© 2023',
          description: 'Old description',
          type: 'Daily Puzzle',
        },
      };

      const result = extractMetadata(oldPuzzle as unknown as PuzzleJson);
      expect(result).toEqual({
        title: 'Old Title',
        author: 'Old Author',
        copyright: '© 2023',
        description: 'Old description',
        type: 'Daily Puzzle',
      });
    });

    it('should handle missing fields', () => {
      const puzzle = {
        solution: [],
      } as PuzzleJson;

      const result = extractMetadata(puzzle);
      expect(result.title).toBe('');
      expect(result.author).toBe('');
      expect(result.copyright).toBe('');
      expect(result.description).toBe('');
    });
  });

  describe('getPuzzleTypeFromDimensions', () => {
    it('should return Mini Puzzle for height <= 10', () => {
      expect(getPuzzleTypeFromDimensions(5)).toBe('Mini Puzzle');
      expect(getPuzzleTypeFromDimensions(10)).toBe('Mini Puzzle');
    });

    it('should return Daily Puzzle for height > 10', () => {
      expect(getPuzzleTypeFromDimensions(11)).toBe('Daily Puzzle');
      expect(getPuzzleTypeFromDimensions(15)).toBe('Daily Puzzle');
      expect(getPuzzleTypeFromDimensions(21)).toBe('Daily Puzzle');
    });
  });

  describe('extractNormalizedData', () => {
    it('should extract all normalized data from ipuz puzzle', () => {
      const puzzle = {
        title: 'Test Puzzle',
        author: 'Test Author',
        copyright: '© 2024',
        notes: 'Notes here',
        version: 'http://ipuz.org/v2',
        kind: ['http://ipuz.org/crossword#1'],
        dimensions: {width: 15, height: 15},
        solution: Array.from({length: 15}, () => Array(15).fill('A')),
      } as unknown as PuzzleJson;

      const result = extractNormalizedData(puzzle);

      expect(result).toEqual({
        title: 'Test Puzzle',
        author: 'Test Author',
        copyright: '© 2024',
        notes: 'Notes here',
        version: 'http://ipuz.org/v2',
        kind: ['http://ipuz.org/crossword#1'],
        width: 15,
        height: 15,
        puzzleType: 'Daily Puzzle',
      });
    });

    it('should extract normalized data from old format puzzle', () => {
      const oldPuzzle: OldPuzzleFormat = {
        grid: [
          ['A', 'B', 'C'],
          ['D', 'E', 'F'],
        ],
        info: {
          title: 'Old Puzzle',
          author: 'Old Author',
          copyright: '© 2023',
          description: 'Old description',
        },
      };

      const result = extractNormalizedData(oldPuzzle as unknown as PuzzleJson);

      expect(result).toEqual({
        title: 'Old Puzzle',
        author: 'Old Author',
        copyright: '© 2023',
        notes: 'Old description',
        version: 'http://ipuz.org/v1',
        kind: ['http://ipuz.org/crossword#1'],
        width: 3,
        height: 2,
        puzzleType: 'Mini Puzzle',
      });
    });

    it('should provide defaults for missing fields', () => {
      const puzzle = {
        solution: [['A']],
      } as PuzzleJson;

      const result = extractNormalizedData(puzzle);

      expect(result.title).toBe('Untitled');
      expect(result.author).toBe('Unknown');
      expect(result.copyright).toBe('');
      expect(result.notes).toBe('');
      expect(result.version).toBe('http://ipuz.org/v1');
      expect(result.kind).toEqual(['http://ipuz.org/crossword#1']);
    });
  });

  describe('normalizeClues', () => {
    it('should normalize v1 array format to v2 object format', () => {
      const clues = {
        Across: [
          ['1', 'First clue'],
          ['2', 'Second clue'],
        ] as [string, string][],
        Down: [
          ['1', 'Down clue 1'],
          ['3', 'Down clue 3'],
        ] as [string, string][],
      };

      const result = normalizeClues(clues);

      expect(result.Across).toEqual([
        {number: '1', clue: 'First clue'},
        {number: '2', clue: 'Second clue'},
      ]);
      expect(result.Down).toEqual([
        {number: '1', clue: 'Down clue 1'},
        {number: '3', clue: 'Down clue 3'},
      ]);
    });

    it('should return v2 format unchanged', () => {
      const clues = {
        Across: [
          {number: '1', clue: 'First clue'},
          {number: '2', clue: 'Second clue'},
        ],
        Down: [{number: '1', clue: 'Down clue'}],
      };

      const result = normalizeClues(clues);

      expect(result.Across).toEqual(clues.Across);
      expect(result.Down).toEqual(clues.Down);
    });

    it('should handle lowercase keys', () => {
      const clues = {
        across: [['1', 'Across clue']] as [string, string][],
        down: [['2', 'Down clue']] as [string, string][],
      };

      const result = normalizeClues(clues);

      expect(result.Across).toEqual([{number: '1', clue: 'Across clue'}]);
      expect(result.Down).toEqual([{number: '2', clue: 'Down clue'}]);
    });

    it('should return empty arrays for undefined clues', () => {
      const result = normalizeClues(undefined);
      expect(result).toEqual({Across: [], Down: []});
    });
  });
});
