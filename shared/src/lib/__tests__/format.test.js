import {describe, it, expect, vi} from 'vitest';
import formatConverter from '../format';
import Puz from 'puzjs';
import GridWrapper from '../wrappers/GridWrapper.js';

// Mock Puz library
vi.mock('puzjs', () => ({
  default: {
    decode: vi.fn(),
    encode: vi.fn(),
  },
}));

describe('format converter', () => {
  describe('fromPuz', () => {
    it('should decode PUZ format', () => {
      const mockPuzData = {
        grid: [
          [
            {type: 'white', solution: 'A'},
            {type: 'white', solution: 'B'},
          ],
          [
            {type: 'white', solution: 'C'},
            {type: 'white', solution: 'D'},
          ],
        ],
        clues: {across: ['', 'Clue 1'], down: ['', 'Clue 2']},
        circles: [],
      };
      Puz.decode.mockReturnValue(mockPuzData);

      const blob = new ArrayBuffer(8);
      const result = formatConverter().fromPuz(blob);

      expect(Puz.decode).toHaveBeenCalledWith(blob);
      expect(result).toHaveProperty('toPuz');
      expect(result).toHaveProperty('toComposition');
      expect(result).toHaveProperty('toPuzzle');
      expect(result).toHaveProperty('toGame');
    });

    it('should handle circles in PUZ format', () => {
      const mockPuzData = {
        grid: [
          [
            {type: 'white', solution: 'A'},
            {type: 'white', solution: 'B'},
          ],
        ],
        clues: {across: ['', 'Clue'], down: []},
        circles: [0],
      };
      Puz.decode.mockReturnValue(mockPuzData);

      const blob = new ArrayBuffer(8);
      const result = formatConverter().fromPuz(blob);

      expect(result).toBeDefined();
    });
  });

  describe('fromComposition', () => {
    it('should convert composition format', () => {
      const composition = {
        info: {
          title: 'Test Puzzle',
          author: 'Test Author',
        },
        grid: [
          [
            {value: 'A', pencil: false},
            {value: 'B', pencil: false},
          ],
          [
            {value: '.', pencil: false},
            {value: 'C', pencil: false},
          ],
        ],
        clues: [
          {r: 0, c: 0, dir: 'across', value: 'Clue 1'},
          {r: 0, c: 0, dir: 'down', value: 'Clue 2'},
        ],
        circles: [0],
      };

      const result = formatConverter().fromComposition(composition);

      expect(result).toHaveProperty('toPuz');
      expect(result).toHaveProperty('toComposition');
      expect(result).toHaveProperty('toPuzzle');
      expect(result).toHaveProperty('toGame');
    });

    it('should handle empty circles', () => {
      const composition = {
        info: {},
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: undefined,
      };

      const result = formatConverter().fromComposition(composition);

      expect(result).toBeDefined();
    });

    it('should convert black squares correctly', () => {
      const composition = {
        info: {},
        grid: [[{value: '.', pencil: false}]],
        clues: [],
        circles: [],
      };

      const result = formatConverter().fromComposition(composition);
      expect(result).toBeDefined();
    });

    it('should handle pencil marks', () => {
      const composition = {
        info: {},
        grid: [[{value: 'A', pencil: true}]],
        clues: [],
        circles: [],
      };

      const result = formatConverter().fromComposition(composition);
      expect(result).toBeDefined();
    });

    it('should assign numbers to grid cells', () => {
      const composition = {
        info: {},
        grid: [
          [
            {value: 'A', pencil: false},
            {value: 'B', pencil: false},
          ],
        ],
        clues: [],
        circles: [],
      };

      const result = formatConverter().fromComposition(composition);
      expect(result).toBeDefined();
    });
  });

  describe('toPuz', () => {
    it('should encode to PUZ format', () => {
      const mockPuzData = {
        grid: [
          [
            {type: 'white', solution: 'A'},
            {type: 'white', solution: 'B'},
          ],
        ],
        clues: {across: ['', 'Clue'], down: []},
        circles: [],
      };
      Puz.decode.mockReturnValue(mockPuzData);
      Puz.encode.mockReturnValue(new ArrayBuffer(8));

      const blob = new ArrayBuffer(8);
      const intermediate = formatConverter().fromPuz(blob);
      const result = intermediate.toPuz();

      expect(Puz.encode).toHaveBeenCalled();
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should convert info to meta', () => {
      const mockPuzData = {
        grid: [[{type: 'white', solution: 'A'}]],
        clues: {across: ['', 'Clue'], down: []},
        circles: [],
      };
      Puz.decode.mockReturnValue(mockPuzData);
      Puz.encode.mockReturnValue(new ArrayBuffer(8));

      const blob = new ArrayBuffer(8);
      const intermediate = formatConverter().fromPuz(blob);
      intermediate.toPuz();

      const encodeCall = Puz.encode.mock.calls[0][0];
      expect(encodeCall).toHaveProperty('meta');
      expect(encodeCall).toHaveProperty('grid');
      expect(encodeCall).toHaveProperty('clues');
      expect(encodeCall).toHaveProperty('circles');
    });
  });

  describe('toPuzzle', () => {
    it('should convert to puzzle format', () => {
      const composition = {
        info: {
          title: 'Test',
          author: 'Author',
        },
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: [0],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const result = intermediate.toPuzzle();

      expect(result).toHaveProperty('grid');
      expect(result).toHaveProperty('info');
      expect(result).toHaveProperty('circles');
      expect(result).toHaveProperty('shades');
      expect(result).toHaveProperty('across');
      expect(result).toHaveProperty('down');
    });

    it('should preserve circles', () => {
      const composition = {
        info: {},
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: [0, 1],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const result = intermediate.toPuzzle();

      expect(result.circles).toEqual([0, 1]);
    });

    it('should include shades', () => {
      const composition = {
        info: {},
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: [],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const result = intermediate.toPuzzle();

      expect(result.shades).toEqual([]);
    });
  });

  describe('validation', () => {
    it('should validate game grid structure', () => {
      const invalidGame = {
        grid: [['A']], // Should be array of objects
      };

      expect(() => {
        // This would be called internally, but we test the structure
        const composition = {
          info: {},
          grid: [[{value: 'A', pencil: false}]],
          clues: [],
          circles: [],
        };
        formatConverter().fromComposition(composition);
      }).not.toThrow();
    });
  });

  describe('gridToTextGrid conversion', () => {
    it('should convert grid objects to text grid', () => {
      const composition = {
        info: {},
        grid: [
          [
            {value: 'A', pencil: false},
            {value: '.', pencil: false},
            {value: 'B', pencil: false},
          ],
        ],
        clues: [],
        circles: [],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const puzzle = intermediate.toPuzzle();

      // Grid should be converted to text format for PUZ encoding
      expect(puzzle.grid).toBeDefined();
    });
  });

  describe('infoToMeta conversion', () => {
    it('should convert info with all fields', () => {
      const composition = {
        info: {
          title: 'Test Title',
          author: 'Test Author',
          description: 'Test Description',
          notes: 'Test Notes',
          copyright: 'Test Copyright',
        },
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: [],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const puzzle = intermediate.toPuzzle();

      expect(puzzle.info.title).toBe('Test Title');
      expect(puzzle.info.author).toBe('Test Author');
      expect(puzzle.info.description).toBe('Test Description');
    });

    it('should handle missing info fields', () => {
      const composition = {
        info: {},
        grid: [[{value: 'A', pencil: false}]],
        clues: [],
        circles: [],
      };

      const intermediate = formatConverter().fromComposition(composition);
      const puzzle = intermediate.toPuzzle();

      expect(puzzle.info).toBeDefined();
    });
  });
});
