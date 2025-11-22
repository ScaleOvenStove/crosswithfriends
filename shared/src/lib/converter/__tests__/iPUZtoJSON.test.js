import {describe, it, expect} from 'vitest';
import iPUZtoJSON from '../iPUZtoJSON';

describe('iPUZtoJSON', () => {
  function createIPUZBuffer(jsonData) {
    const jsonString = JSON.stringify(jsonData);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer;
  }

  it('should convert iPUZ JSON to internal format', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      title: 'Test Puzzle',
      author: 'Test Author',
      notes: 'Test Notes',
      solution: [['A', 'B'], ['C', 'D']],
      puzzle: [[null, null], [null, null]],
      clues: {
        Across: [[1, 'Clue 1']],
        Down: [[1, 'Clue 2']],
      },
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result).toHaveProperty('grid');
    expect(result).toHaveProperty('info');
    expect(result).toHaveProperty('circles');
    expect(result).toHaveProperty('shades');
    expect(result).toHaveProperty('across');
    expect(result).toHaveProperty('down');
  });

  it('should convert solution grid correctly', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A', 'B'], ['C', '.']],
      puzzle: [[null, null], [null, null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.grid[0][0]).toBe('A');
    expect(result.grid[0][1]).toBe('B');
    expect(result.grid[1][0]).toBe('C');
    expect(result.grid[1][1]).toBe('.');
  });

  it('should convert null cells to dots', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [[null, 'A'], ['B', null]],
      puzzle: [[null, null], [null, null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.grid[0][0]).toBe('.');
    expect(result.grid[0][1]).toBe('A');
    expect(result.grid[1][0]).toBe('B');
    expect(result.grid[1][1]).toBe('.');
  });

  it('should convert # cells to dots', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['#', 'A'], ['B', '#']],
      puzzle: [[null, null], [null, null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.grid[0][0]).toBe('.');
    expect(result.grid[0][1]).toBe('A');
    expect(result.grid[1][0]).toBe('B');
    expect(result.grid[1][1]).toBe('.');
  });

  it('should extract info fields', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      title: 'My Puzzle',
      author: 'John Doe',
      notes: 'A test puzzle',
      solution: [['A']],
      puzzle: [[null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.info.title).toBe('My Puzzle');
    expect(result.info.author).toBe('John Doe');
    expect(result.info.description).toBe('A test puzzle');
  });

  it('should set type based on grid size', () => {
    const smallPuzzle = {
      version: 'http://ipuz.org/v1',
      solution: [['A', 'B'], ['C', 'D']],
      puzzle: [[null, null], [null, null]],
      clues: {Across: [], Down: []},
    };
    const largePuzzle = {
      version: 'http://ipuz.org/v1',
      solution: Array(15).fill(null).map(() => Array(15).fill('A')),
      puzzle: Array(15).fill(null).map(() => Array(15).fill(null)),
      clues: {Across: [], Down: []},
    };

    const smallBuffer = createIPUZBuffer(smallPuzzle);
    const largeBuffer = createIPUZBuffer(largePuzzle);

    const smallResult = iPUZtoJSON(smallBuffer);
    const largeResult = iPUZtoJSON(largeBuffer);

    expect(smallResult.info.type).toBe('Mini Puzzle');
    expect(largeResult.info.type).toBe('Daily Puzzle');
  });

  it('should handle missing info fields', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A']],
      puzzle: [[null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.info.title).toBe('');
    expect(result.info.author).toBe('');
    expect(result.info.description).toBe('');
  });

  it('should convert clues from array format', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A', 'B']],
      puzzle: [[null, null]],
      clues: {
        Across: [[1, 'Clue 1'], [2, 'Clue 2']],
        Down: [],
      },
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.across[1]).toBe('Clue 1');
    expect(result.across[2]).toBe('Clue 2');
  });

  it('should convert clues from object format', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A']],
      puzzle: [[null]],
      clues: {
        Across: [{number: 1, clue: 'Clue 1'}],
        Down: [],
      },
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.across[1]).toBe('Clue 1');
  });

  it('should detect circles from puzzle style', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A', 'B']],
      puzzle: [
        [{style: {shapebg: 'circle'}}, null],
      ],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.circles).toContain(0);
  });

  it('should return empty circles array when no circles', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A']],
      puzzle: [[null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.circles).toEqual([]);
  });

  it('should handle multiple circles', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A', 'B', 'C']],
      puzzle: [
        [
          {style: {shapebg: 'circle'}},
          null,
          {style: {shapebg: 'circle'}},
        ],
      ],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.circles.length).toBe(2);
    expect(result.circles).toContain(0);
    expect(result.circles).toContain(2);
  });

  it('should return empty shades array', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A']],
      puzzle: [[null]],
      clues: {Across: [], Down: []},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.shades).toEqual([]);
  });

  it('should handle empty clues', () => {
    const ipuzData = {
      version: 'http://ipuz.org/v1',
      solution: [['A']],
      puzzle: [[null]],
      clues: {},
    };
    const buffer = createIPUZBuffer(ipuzData);
    const result = iPUZtoJSON(buffer);

    expect(result.across).toEqual([]);
    expect(result.down).toEqual([]);
  });
});

