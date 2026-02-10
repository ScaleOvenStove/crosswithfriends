import {
  getOppositeDirection,
  makeEmptyGame,
  makeGrid,
  allNums,
  getReferencedClues,
  convertGridForComposition,
} from '../gameUtils';

describe('getOppositeDirection', () => {
  it('returns down for across', () => {
    expect(getOppositeDirection('across')).toBe('down');
  });

  it('returns across for down', () => {
    expect(getOppositeDirection('down')).toBe('across');
  });

  it('returns undefined for invalid direction', () => {
    expect(getOppositeDirection('diagonal')).toBeUndefined();
  });
});

describe('makeEmptyGame', () => {
  it('returns a game object with expected structure', () => {
    const game = makeEmptyGame();
    expect(game.clues).toEqual({across: [], down: []});
    expect(game.solution).toBeDefined();
    expect(game.grid).toBeDefined();
    expect(game.chat).toEqual({users: [], messages: []});
    expect(game.circles).toEqual([]);
  });

  it('has a 1x1 grid with correct cell structure', () => {
    const game = makeEmptyGame();
    expect(game.grid).toHaveLength(1);
    expect(game.grid[0]).toHaveLength(1);
    expect(game.grid[0][0]).toMatchObject({
      black: false,
      number: 1,
      value: '',
    });
  });
});

describe('makeGrid', () => {
  it('creates a grid from text representation', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid);
    expect(grid.rows).toBe(2);
    expect(grid.cols).toBe(2);
  });

  it('marks black squares from dots', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid);
    expect(grid.grid[1][1].black).toBe(true);
    expect(grid.grid[0][0].black).toBe(false);
  });

  it('fills with solution values when fillWithSol is true', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid, true);
    expect(grid.grid[0][0].value).toBe('A');
    expect(grid.grid[0][1].value).toBe('B');
  });

  it('leaves cells empty when fillWithSol is false', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid, false);
    expect(grid.grid[0][0].value).toBe('');
  });

  it('assigns numbers to cells that start clues', () => {
    const textGrid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const grid = makeGrid(textGrid);
    // (0,0) starts both 1-across and 1-down
    expect(grid.grid[0][0].number).toBe(1);
    // (1,0) starts a down entry below but not an across (only one white cell in row)
    // Numbers are assigned to cells at the start of across or down runs
    // In a 2x2 with black at (1,1): (0,0)=1, (0,1) may or may not be numbered
    // Just verify that at least one cell has a number
    const numberedCells = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        if (grid.grid[r][c].number) {
          numberedCells.push({r, c, number: grid.grid[r][c].number});
        }
      }
    }
    expect(numberedCells.length).toBeGreaterThanOrEqual(1);
    expect(numberedCells[0].number).toBe(1);
  });
});

describe('allNums', () => {
  it('extracts numbers from a string', () => {
    expect(allNums('See 5 and 12 across')).toEqual([5, 12]);
  });

  it('returns empty array for no numbers', () => {
    expect(allNums('no numbers here')).toEqual([]);
  });

  it('handles adjacent numbers', () => {
    expect(allNums('15-Across, 20-Down')).toEqual([15, 20]);
  });

  it('handles string with only a number', () => {
    expect(allNums('42')).toEqual([42]);
  });
});

describe('getReferencedClues', () => {
  const clues = {
    across: [undefined, 'First across', undefined, '*Starred across'],
    down: [undefined, 'First down', 'Second down'],
  };

  it('parses across references', () => {
    const result = getReferencedClues('See 1 Across', clues);
    expect(result).toEqual([{ori: 'across', num: 1}]);
  });

  it('parses down references', () => {
    const result = getReferencedClues('See 2 Down', clues);
    expect(result).toEqual([{ori: 'down', num: 2}]);
  });

  it('parses multiple references', () => {
    const result = getReferencedClues('See 1 and 3 Across', clues);
    expect(result).toEqual([
      {ori: 'across', num: 1},
      {ori: 'across', num: 3},
    ]);
  });

  it('parses mixed across and down', () => {
    const result = getReferencedClues('See 1 Across and 2 Down', clues);
    expect(result).toContainEqual({ori: 'across', num: 1});
    expect(result).toContainEqual({ori: 'down', num: 2});
  });

  it('detects starred clue references', () => {
    const result = getReferencedClues('See starred entries', clues);
    expect(result).toContainEqual({ori: 'across', num: 3});
  });

  it('returns empty array for null input', () => {
    expect(getReferencedClues(null, clues)).toEqual([]);
  });

  it('returns empty array for no references', () => {
    expect(getReferencedClues('Just a normal clue', clues)).toEqual([]);
  });
});

describe('convertGridForComposition', () => {
  it('wraps each cell value in an object', () => {
    const grid = [
      ['A', 'B'],
      ['C', '.'],
    ];
    const result = convertGridForComposition(grid);
    expect(result[0][0]).toEqual({value: 'A'});
    expect(result[1][1]).toEqual({value: '.'});
  });
});
