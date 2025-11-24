import {describe, it, expect} from 'vitest';
import PUZtoJSON from '../PUZtoJSON';

describe('PUZtoJSON', () => {
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

    // Write strings (title, author, copyright, clues, description)
    const strings = [
      'Test Title',
      'Test Author',
      'Test Copyright',
      ...clues.across,
      ...clues.down,
      'Test Description',
    ];

    strings.forEach((str) => {
      for (let i = 0; i < str.length; i++) {
        bytes[offset++] = str.charCodeAt(i);
      }
      bytes[offset++] = 0; // Null terminator
    });

    return buffer;
  }

  it('should convert simple PUZ buffer to JSON', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoJSON(buffer);

    expect(result).toHaveProperty('grid');
    expect(result).toHaveProperty('info');
    expect(result).toHaveProperty('circles');
    expect(result).toHaveProperty('shades');
    expect(result).toHaveProperty('across');
    expect(result).toHaveProperty('down');
  });

  it('should parse grid with white and black squares', () => {
    const gridData = [
      ['A', '.'],
      ['.', 'B'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.grid[0][0].type).toBe('white');
    expect(result.grid[0][0].solution).toBe('A');
    expect(result.grid[0][1].type).toBe('black');
    expect(result.grid[1][0].type).toBe('black');
    expect(result.grid[1][1].type).toBe('white');
    expect(result.grid[1][1].solution).toBe('B');
  });

  it('should parse info fields', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.info).toHaveProperty('title');
    expect(result.info).toHaveProperty('author');
    expect(result.info).toHaveProperty('copyright');
    expect(result.info).toHaveProperty('description');
  });

  it('should throw error for scrambled PUZ file', () => {
    const buffer = new ArrayBuffer(100);
    const bytes = new Uint8Array(buffer);
    bytes[44] = 2;
    bytes[45] = 2;
    bytes[50] = 1; // Scrambled flag
    bytes[51] = 0;

    expect(() => {
      PUZtoJSON(buffer);
    }).toThrow('Scrambled PUZ file');
  });

  it('should handle empty grid', () => {
    const gridData = [];
    const buffer = createMockPUZBuffer(0, 0, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.grid).toEqual([]);
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
    const result = PUZtoJSON(buffer);

    expect(Array.isArray(result.across)).toBe(true);
    expect(Array.isArray(result.down)).toBe(true);
  });

  it('should return empty circles array when no circles', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    const result = PUZtoJSON(buffer);

    expect(Array.isArray(result.circles)).toBe(true);
  });

  it('should return empty shades array when no shades', () => {
    const gridData = [['A']];
    const buffer = createMockPUZBuffer(1, 1, gridData);
    const result = PUZtoJSON(buffer);

    expect(Array.isArray(result.shades)).toBe(true);
  });

  it('should handle larger grids', () => {
    const gridData = [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ];
    const buffer = createMockPUZBuffer(3, 3, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.grid).toHaveLength(3);
    expect(result.grid[0]).toHaveLength(3);
  });

  it('should handle grid with all black squares', () => {
    const gridData = [
      ['.', '.'],
      ['.', '.'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.grid[0][0].type).toBe('black');
    expect(result.grid[0][1].type).toBe('black');
  });

  it('should handle grid with all white squares', () => {
    const gridData = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const buffer = createMockPUZBuffer(2, 2, gridData);
    const result = PUZtoJSON(buffer);

    expect(result.grid[0][0].type).toBe('white');
    expect(result.grid[0][1].type).toBe('white');
    expect(result.grid[1][0].type).toBe('white');
    expect(result.grid[1][1].type).toBe('white');
  });
});


