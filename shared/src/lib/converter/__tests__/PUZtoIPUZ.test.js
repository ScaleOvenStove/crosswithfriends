import {describe, it, expect} from 'vitest';
import PUZtoIPUZ from '../PUZtoIPUZ';

describe('PUZtoIPUZ', () => {
  function createMockPUZBuffer(nrow, ncol, gridData, clues = {across: [], down: []}) {
    const buffer = new ArrayBuffer(1000);
    const bytes = new Uint8Array(buffer);

    // Set dimensions
    bytes[44] = ncol;
    bytes[45] = nrow;

    // Set unscrambled flag (bytes 50-51 should be 0)
    bytes[50] = 0;
    bytes[51] = 0;

    // Write grid data starting at byte 52
    let offset = 52;
    for (let i = 0; i < nrow; i++) {
      for (let j = 0; j < ncol; j++) {
        const cell = gridData[i][j];
        bytes[offset++] = cell === '.' ? '.'.charCodeAt(0) : cell.charCodeAt(0);
      }
    }

    // Write solution (same as grid for simplicity)
    for (let i = 0; i < nrow; i++) {
      for (let j = 0; j < ncol; j++) {
        const cell = gridData[i][j];
        bytes[offset++] = cell === '.' ? '.'.charCodeAt(0) : cell.charCodeAt(0);
      }
    }

    // Write strings (title, author, copyright, clues, notes)
    const strings = [
      'Test Title',
      'Test Author',
      'Test Copyright',
      ...clues.across,
      ...clues.down,
      'Test Notes',
    ];

    strings.forEach((str) => {
      for (let i = 0; i < str.length; i++) {
        bytes[offset++] = str.charCodeAt(i);
      }
      bytes[offset++] = 0; // Null terminator
    });

    return buffer;
  }

  it('should convert PUZ buffer to iPUZ format', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('kind');
    expect(result).toHaveProperty('dimensions');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('author');
    expect(result).toHaveProperty('copyright');
    expect(result).toHaveProperty('notes');
    expect(result).toHaveProperty('solution');
    expect(result).toHaveProperty('puzzle');
    expect(result).toHaveProperty('clues');
  });

  it('should set correct version and kind', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.version).toBe('http://ipuz.org/v1');
    expect(result.kind).toEqual(['http://ipuz.org/crossword#1']);
  });

  it('should set correct dimensions', () => {
    const gridData = [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ];
    const buffer = createMockPUZBuffer(2, 3, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.dimensions.width).toBe(3);
    expect(result.dimensions.height).toBe(2);
  });

  it('should convert solution grid with null for black squares', () => {
    const gridData = [
      ['A', '.'],
      ['.', 'B'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.solution[0][0]).toBe('A');
    expect(result.solution[0][1]).toBe(null);
    expect(result.solution[1][0]).toBe(null);
    expect(result.solution[1][1]).toBe('B');
  });

  it('should convert puzzle grid with # for black squares', () => {
    const gridData = [
      ['A', '.'],
      ['.', 'B'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.puzzle[0][0]).not.toBe('#');
    expect(result.puzzle[0][1]).toBe('#');
    expect(result.puzzle[1][0]).toBe('#');
    expect(result.puzzle[1][1]).not.toBe('#');
  });

  it('should extract metadata fields', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.title).toBe('Test Title');
    expect(result.author).toBe('Test Author');
    expect(result.copyright).toBe('Test Copyright');
    expect(result.notes).toBe('Test Notes');
  });

  it('should handle empty metadata fields', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    // Modify buffer to have empty strings
    const bytes = new Uint8Array(buffer);
    let offset = 52 + 1 * 1 * 2; // After grid and solution
    bytes[offset++] = 0; // Empty title
    bytes[offset++] = 0; // Empty author
    bytes[offset++] = 0; // Empty copyright
    // Skip clues
    bytes[offset++] = 0; // Empty notes

    const result = PUZtoIPUZ(buffer);
    expect(result.title).toBe('');
    expect(result.author).toBe('');
  });

  it('should parse clues correctly', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const clues = {
      across: ['Clue 1', 'Clue 2'],
      down: ['Clue 3'],
    };
    const buffer = createMockPUZBuffer(2, 2, gridData, clues);
    const result = PUZtoIPUZ(buffer);

    expect(result.clues).toHaveProperty('Across');
    expect(result.clues).toHaveProperty('Down');
    expect(Array.isArray(result.clues.Across)).toBe(true);
    expect(Array.isArray(result.clues.Down)).toBe(true);
  });

  it('should format clues as [number, text] arrays', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const clues = {
      across: ['Clue 1'],
      down: [],
    };
    const buffer = createMockPUZBuffer(2, 2, gridData, clues);
    const result = PUZtoIPUZ(buffer);

    if (result.clues.Across.length > 0) {
      expect(Array.isArray(result.clues.Across[0])).toBe(true);
      expect(result.clues.Across[0][0]).toBe('1'); // Clue number as string
      expect(result.clues.Across[0][1]).toBe('Clue 1');
    }
  });

  it('should throw error for scrambled PUZ file', () => {
    const buffer = new ArrayBuffer(100);
    const bytes = new Uint8Array(buffer);
    bytes[44] = 2;
    bytes[45] = 2;
    bytes[50] = 1; // Scrambled flag
    bytes[51] = 0;

    expect(() => {
      PUZtoIPUZ(buffer);
    }).toThrow('Scrambled PUZ file');
  });

  it('should handle empty grid', () => {
    const gridData = [];
    const buffer = createMockPUZBuffer(0, 0, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.solution).toEqual([]);
    expect(result.puzzle).toEqual([]);
  });

  it('should handle grid with all white squares', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.solution[0][0]).toBe('A');
    expect(result.solution[0][1]).toBe('B');
    expect(result.solution[1][0]).toBe('C');
    expect(result.solution[1][1]).toBe('D');
  });

  it('should handle grid with all black squares', () => {
    const gridData = [
      ['.', '.'],
      ['.', '.'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.solution[0][0]).toBe(null);
    expect(result.solution[0][1]).toBe(null);
    expect(result.puzzle[0][0]).toBe('#');
    expect(result.puzzle[0][1]).toBe('#');
  });

  it('should assign clue numbers to puzzle grid', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoIPUZ(buffer);

    // First cell should have a clue number
    const firstCell = result.puzzle[0][0];
    expect(firstCell === 1 || (typeof firstCell === 'object' && firstCell.cell === 1)).toBe(true);
  });

  it('should handle larger grids', () => {
    const gridData = [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ];
    const buffer = createMockPUZBuffer(3, 3, gridData);
    const result = PUZtoIPUZ(buffer);

    expect(result.solution).toHaveLength(3);
    expect(result.solution[0]).toHaveLength(3);
    expect(result.puzzle).toHaveLength(3);
    expect(result.puzzle[0]).toHaveLength(3);
  });
});
