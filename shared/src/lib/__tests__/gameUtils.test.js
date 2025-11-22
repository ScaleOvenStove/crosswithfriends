import {describe, it, expect} from 'vitest';
import {
  getOppositeDirection,
  makeEmptyGame,
  makeGrid,
  makeGridFromComposition,
  makeClues,
  convertCluesForComposition,
  convertGridForComposition,
  makeEmptyClues,
  allNums,
  getReferencedClues,
} from '../gameUtils';
import GridWrapper from '../wrappers/GridWrapper';

describe('getOppositeDirection', () => {
  it('should return "down" for "across"', () => {
    expect(getOppositeDirection('across')).toBe('down');
  });

  it('should return "across" for "down"', () => {
    expect(getOppositeDirection('down')).toBe('across');
  });

  it('should return undefined for invalid direction', () => {
    expect(getOppositeDirection('invalid')).toBeUndefined();
  });
});

describe('makeEmptyGame', () => {
  it('should create empty game structure', () => {
    const game = makeEmptyGame();
    expect(game).toHaveProperty('gid');
    expect(game).toHaveProperty('name');
    expect(game).toHaveProperty('info');
    expect(game).toHaveProperty('clues');
    expect(game).toHaveProperty('solution');
    expect(game).toHaveProperty('grid');
    expect(game).toHaveProperty('createTime');
    expect(game).toHaveProperty('startTime');
    expect(game).toHaveProperty('chat');
    expect(game).toHaveProperty('circles');
  });

  it('should have empty clues structure', () => {
    const game = makeEmptyGame();
    expect(game.clues.across).toEqual([]);
    expect(game.clues.down).toEqual([]);
  });

  it('should have single cell grid', () => {
    const game = makeEmptyGame();
    expect(game.grid).toHaveLength(1);
    expect(game.grid[0]).toHaveLength(1);
    expect(game.grid[0][0]).toHaveProperty('black', false);
    expect(game.grid[0][0]).toHaveProperty('number', 1);
    expect(game.grid[0][0]).toHaveProperty('value', '');
  });

  it('should have empty chat structure', () => {
    const game = makeEmptyGame();
    expect(game.chat.users).toEqual([]);
    expect(game.chat.messages).toEqual([]);
  });
});

describe('makeGrid', () => {
  it('should create grid from text grid', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid, false);
    expect(grid).toBeInstanceOf(GridWrapper);
    expect(grid.grid[0][0].value).toBe('');
    expect(grid.grid[0][0].black).toBe(false);
    expect(grid.grid[1][1].black).toBe(true);
  });

  it('should fill with solution when fillWithSol is true', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, true);
    expect(grid.grid[0][0].value).toBe('A');
    expect(grid.grid[0][1].value).toBe('B');
    expect(grid.grid[1][0].value).toBe('C');
    expect(grid.grid[1][1].value).toBe('D');
  });

  it('should assign numbers to cells', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, false);
    // First cell should be numbered
    expect(grid.grid[0][0].number).not.toBeNull();
  });

  it('should handle black squares', () => {
    const textGrid = [
      ['.', 'A'],
      ['B', '.'],
    ];
    const grid = makeGrid(textGrid, false);
    expect(grid.grid[0][0].black).toBe(true);
    expect(grid.grid[0][1].black).toBe(false);
    expect(grid.grid[1][0].black).toBe(false);
    expect(grid.grid[1][1].black).toBe(true);
  });

  it('should initialize edits array', () => {
    const textGrid = [['A']];
    const grid = makeGrid(textGrid, false);
    expect(grid.grid[0][0].edits).toEqual([]);
  });
});

describe('makeGridFromComposition', () => {
  it('should create grid from composition format', () => {
    const compositionGrid = [
      [{value: 'A', pencil: false}],
      [{value: '.', pencil: false}],
    ];
    const grid = makeGridFromComposition(compositionGrid);
    expect(grid).toBeInstanceOf(GridWrapper);
    expect(grid.grid[0][0].value).toBe('A');
    expect(grid.grid[0][0].black).toBe(false);
    expect(grid.grid[1][0].black).toBe(true);
    expect(grid.grid[1][0].value).toBe('');
  });

  it('should preserve pencil marks', () => {
    const compositionGrid = [
      [{value: 'A', pencil: true}],
    ];
    const grid = makeGridFromComposition(compositionGrid);
    expect(grid.grid[0][0].pencil).toBe(true);
  });

  it('should convert black squares correctly', () => {
    const compositionGrid = [
      [{value: '.', pencil: false}],
    ];
    const grid = makeGridFromComposition(compositionGrid);
    expect(grid.grid[0][0].black).toBe(true);
    expect(grid.grid[0][0].value).toBe('');
  });

  it('should assign numbers to starting cells', () => {
    // Need at least 2 cells in a row to have a number assigned
    const compositionGrid = [
      [{value: 'A', pencil: false}, {value: 'B', pencil: false}],
    ];
    const grid = makeGridFromComposition(compositionGrid);
    // First cell should be numbered as it's the start of a clue
    expect(grid.grid[0][0].number).not.toBeNull();
  });
});

describe('makeClues', () => {
  it('should create clues from cluesBySquare', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, false);
    const cluesBySquare = [
      {r: 0, c: 0, dir: 'across', value: 'Clue 1'},
      {r: 0, c: 0, dir: 'down', value: 'Clue 2'},
    ];
    const clues = makeClues(cluesBySquare, grid.grid);
    expect(clues).toHaveProperty('across');
    expect(clues).toHaveProperty('down');
  });

  it('should skip clues for cells without numbers', () => {
    const textGrid = [['.']];
    const grid = makeGrid(textGrid, false);
    const cluesBySquare = [
      {r: 0, c: 0, dir: 'across', value: 'Clue'},
    ];
    const clues = makeClues(cluesBySquare, grid.grid);
    // Black square shouldn't have a clue
    expect(clues.across.filter((c) => c).length).toBe(0);
  });

  it('should align clues correctly', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, false);
    const cluesBySquare = [
      {r: 0, c: 0, dir: 'across', value: 'Clue 1'},
    ];
    const clues = makeClues(cluesBySquare, grid.grid);
    expect(clues).toBeInstanceOf(Object);
    expect(Array.isArray(clues.across)).toBe(true);
    expect(Array.isArray(clues.down)).toBe(true);
  });
});

describe('convertCluesForComposition', () => {
  it('should convert clues to composition format', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, false);
    const clues = {
      across: ['', 'Clue 1'],
      down: ['', 'Clue 2'],
    };
    const result = convertCluesForComposition(clues, grid);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should include direction, row, column, and value', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const grid = makeGrid(textGrid, false);
    const clues = {
      across: ['', 'Clue 1'],
      down: [],
    };
    const result = convertCluesForComposition(clues, grid);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('dir');
      expect(result[0]).toHaveProperty('r');
      expect(result[0]).toHaveProperty('c');
      expect(result[0]).toHaveProperty('value');
    }
  });

  it('should skip clues for cells that cannot be found', () => {
    const textGrid = [['.']];
    const grid = makeGrid(textGrid, false);
    const clues = {
      across: ['', 'Clue 1'],
      down: [],
    };
    const result = convertCluesForComposition(clues, grid);
    // Should handle gracefully when cell cannot be found
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('convertGridForComposition', () => {
  it('should convert grid to composition format', () => {
    const grid = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const result = convertGridForComposition(grid);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2);
    expect(result[0][0]).toHaveProperty('value', 'A');
  });

  it('should preserve all values', () => {
    const grid = [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
    ];
    const result = convertGridForComposition(grid);
    expect(result[0][0].value).toBe('A');
    expect(result[0][1].value).toBe('B');
    expect(result[0][2].value).toBe('C');
    expect(result[1][0].value).toBe('D');
    expect(result[1][1].value).toBe('E');
    expect(result[1][2].value).toBe('F');
  });

  it('should handle empty grid', () => {
    const grid = [];
    const result = convertGridForComposition(grid);
    expect(result).toEqual([]);
  });
});

describe('makeEmptyClues', () => {
  it('should create empty clues structure', () => {
    const gridArray = [
      [
        {black: false, value: 'A', number: 1, parents: {across: 1, down: 1}},
        {black: false, value: 'B', number: null, parents: {across: 1, down: 2}},
      ],
    ];
    const clues = makeEmptyClues(gridArray);
    expect(clues).toHaveProperty('across');
    expect(clues).toHaveProperty('down');
    expect(Array.isArray(clues.across)).toBe(true);
    expect(Array.isArray(clues.down)).toBe(true);
  });

  it('should align clues correctly', () => {
    const gridArray = [
      [
        {black: false, value: 'A', number: 1, parents: {across: 1, down: 1}},
      ],
    ];
    const clues = makeEmptyClues(gridArray);
    expect(clues.across.length).toBeGreaterThan(0);
    expect(clues.down.length).toBeGreaterThan(0);
  });
});

describe('allNums', () => {
  it('should extract all numbers from string', () => {
    expect(allNums('abc123def456')).toEqual([123, 456]);
  });

  it('should extract single number', () => {
    expect(allNums('123')).toEqual([123]);
  });

  it('should extract multiple numbers', () => {
    expect(allNums('1 2 3 4 5')).toEqual([1, 2, 3, 4, 5]);
  });

  it('should return empty array for string without numbers', () => {
    expect(allNums('abc')).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(allNums('')).toEqual([]);
  });

  it('should handle consecutive numbers', () => {
    expect(allNums('123456')).toEqual([123456]);
  });

  it('should handle numbers with other characters', () => {
    expect(allNums('test123test456test')).toEqual([123, 456]);
  });
});

describe('getReferencedClues', () => {
  it('should return empty array for empty string', () => {
    expect(getReferencedClues('', {across: [], down: []})).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(getReferencedClues(null, {across: [], down: []})).toEqual([]);
    expect(getReferencedClues(undefined, {across: [], down: []})).toEqual([]);
  });

  it('should extract across references', () => {
    const clues = {
      across: ['', 'Clue 1', 'Clue 2'],
      down: ['', 'Clue 3'],
    };
    const result = getReferencedClues('1 2 across', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
    expect(result).toContainEqual({ori: 'across', num: 2});
  });

  it('should extract down references', () => {
    const clues = {
      across: ['', 'Clue 1'],
      down: ['', 'Clue 2', 'Clue 3'],
    };
    const result = getReferencedClues('2 3 down', clues);
    expect(result).toContainEqual({ori: 'down', num: 2});
    expect(result).toContainEqual({ori: 'down', num: 3});
  });

  it('should extract mixed references', () => {
    const clues = {
      across: ['', 'Clue 1', 'Clue 2'],
      down: ['', 'Clue 3'],
    };
    const result = getReferencedClues('1 across 3 down', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
    expect(result).toContainEqual({ori: 'down', num: 3});
  });

  it('should handle case insensitive input', () => {
    const clues = {
      across: ['', 'Clue 1'],
      down: [],
    };
    const result = getReferencedClues('1 ACROSS', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
  });

  it('should extract starred clues', () => {
    const clues = {
      across: ['', '*Clue 1', 'Clue 2'],
      down: ['', 'Clue 3*', 'Clue 4'],
    };
    const result = getReferencedClues('starred clues', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
    expect(result).toContainEqual({ori: 'down', num: 1});
  });

  it('should extract starred entries', () => {
    const clues = {
      across: ['', '*Clue 1'],
      down: [],
    };
    const result = getReferencedClues('starred entries', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
  });

  it('should handle multiple references in sequence', () => {
    const clues = {
      across: ['', 'Clue 1', 'Clue 2', 'Clue 3'],
      down: [],
    };
    const result = getReferencedClues('1 2 3 across', clues);
    expect(result.length).toBe(3);
    expect(result).toContainEqual({ori: 'across', num: 1});
    expect(result).toContainEqual({ori: 'across', num: 2});
    expect(result).toContainEqual({ori: 'across', num: 3});
  });

  it('should handle starred clue with spaces', () => {
    const clues = {
      across: ['', ' * Clue 1'],
      down: [],
    };
    const result = getReferencedClues('starred clue', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
  });

  it('should not extract starred clues if keyword not present', () => {
    const clues = {
      across: ['', '*Clue 1'],
      down: [],
    };
    const result = getReferencedClues('just a clue', clues);
    expect(result).toEqual([]);
  });
});

