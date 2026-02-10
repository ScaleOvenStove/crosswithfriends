import GridWrapper from '../GridWrapper';

function makeGrid() {
  // 3x3 grid with black square at (1,1)
  //  A B C
  //  D . E
  //  F G H
  const grid = [
    [
      {value: 'A', black: false},
      {value: 'B', black: false},
      {value: 'C', black: false},
    ],
    [
      {value: 'D', black: false},
      {value: '', black: true},
      {value: 'E', black: false},
    ],
    [
      {value: 'F', black: false},
      {value: 'G', black: false},
      {value: 'H', black: false},
    ],
  ];
  const wrapper = new GridWrapper(grid);
  wrapper.assignNumbers();
  return wrapper;
}

describe('GridWrapper constructor', () => {
  it('throws on undefined grid', () => {
    expect(() => new GridWrapper(undefined)).toThrow('undefined grid');
  });

  it('throws on non-array grid', () => {
    expect(() => new GridWrapper('not an array')).toThrow('Invalid type');
  });
});

describe('getNextCell', () => {
  const grid = makeGrid();

  it('moves right in across direction', () => {
    expect(grid.getNextCell(0, 0, 'across')).toEqual({r: 0, c: 1});
  });

  it('moves down in down direction', () => {
    expect(grid.getNextCell(0, 0, 'down')).toEqual({r: 1, c: 0});
  });

  it('returns undefined when hitting black square', () => {
    // (0,1) → (1,1) is black
    expect(grid.getNextCell(0, 1, 'down')).toBeUndefined();
  });

  it('returns undefined when out of bounds', () => {
    expect(grid.getNextCell(0, 2, 'across')).toBeUndefined();
    expect(grid.getNextCell(2, 0, 'down')).toBeUndefined();
  });
});

describe('getPreviousCell', () => {
  const grid = makeGrid();

  it('moves left in across direction', () => {
    expect(grid.getPreviousCell(0, 1, 'across')).toEqual({r: 0, c: 0});
  });

  it('moves up in down direction', () => {
    expect(grid.getPreviousCell(1, 0, 'down')).toEqual({r: 0, c: 0});
  });

  it('returns undefined at top edge', () => {
    expect(grid.getPreviousCell(0, 0, 'down')).toBeUndefined();
  });

  it('returns undefined at left edge', () => {
    expect(grid.getPreviousCell(0, 0, 'across')).toBeUndefined();
  });
});

describe('getEdge', () => {
  const grid = makeGrid();

  it('finds start of across word', () => {
    const start = grid.getEdge(0, 2, 'across', true);
    expect(start).toEqual({r: 0, c: 0});
  });

  it('finds end of across word', () => {
    const end = grid.getEdge(0, 0, 'across', false);
    expect(end).toEqual({r: 0, c: 2});
  });

  it('finds start of down word', () => {
    const start = grid.getEdge(2, 0, 'down', true);
    expect(start).toEqual({r: 0, c: 0});
  });

  it('finds end of down word', () => {
    const end = grid.getEdge(0, 0, 'down', false);
    expect(end).toEqual({r: 2, c: 0});
  });
});

describe('clueLengths', () => {
  const grid = makeGrid();

  it('returns across and down clue lengths', () => {
    const lengths = grid.clueLengths;
    expect(lengths.across).toBeDefined();
    expect(lengths.down).toBeDefined();
  });

  it('top row across clue has length 3', () => {
    const lengths = grid.clueLengths;
    // Clue 1 across starts at (0,0) and spans 3 cells
    expect(lengths.across[1]).toBe(3);
  });
});

describe('fixSelect', () => {
  const grid = makeGrid();

  it('returns same cell if already white', () => {
    expect(grid.fixSelect({r: 0, c: 0})).toEqual({r: 0, c: 0});
  });

  it('advances past black square to next white', () => {
    // (1,1) is black, should advance to (1,2)
    expect(grid.fixSelect({r: 1, c: 1})).toEqual({r: 1, c: 2});
  });
});

describe('alignClues', () => {
  const grid = makeGrid();

  it('aligns clues to numbered cells', () => {
    const clues = {
      across: [],
      down: [],
    };
    clues.across[1] = 'Top row';
    clues.down[1] = 'Left column';

    const aligned = grid.alignClues(clues);
    expect(aligned.across[1]).toBe('Top row');
    expect(aligned.down[1]).toBe('Left column');
  });

  it('fills missing clues with empty string', () => {
    const aligned = grid.alignClues({across: [], down: []});
    // All clue slots should exist as empty strings
    const acrossClues = aligned.across.filter((c) => c !== undefined);
    acrossClues.forEach((c) => {
      expect(typeof c).toBe('string');
    });
  });
});

describe('isSolved', () => {
  it('returns true when all values match solution', () => {
    const grid = makeGrid();
    const solution = [
      ['A', 'B', 'C'],
      ['D', '.', 'E'],
      ['F', 'G', 'H'],
    ];
    expect(grid.isSolved(solution)).toBe(true);
  });

  it('returns false when a value differs', () => {
    const grid = makeGrid();
    const solution = [
      ['X', 'B', 'C'],
      ['D', '.', 'E'],
      ['F', 'G', 'H'],
    ];
    expect(grid.isSolved(solution)).toBe(false);
  });
});

describe('getWritableLocations', () => {
  const grid = makeGrid();

  it('returns all non-black cells', () => {
    const locations = grid.getWritableLocations();
    // 3x3 grid with 1 black = 8 writable
    expect(locations).toHaveLength(8);
  });

  it('does not include black square', () => {
    const locations = grid.getWritableLocations();
    const hasBlack = locations.some(({i, j}) => i === 1 && j === 1);
    expect(hasBlack).toBe(false);
  });
});

describe('toTextGrid', () => {
  it('converts grid to text representation', () => {
    const grid = makeGrid();
    const text = grid.toTextGrid();
    expect(text[0]).toEqual(['A', 'B', 'C']);
    expect(text[1][1]).toBe('.');
    expect(text[2]).toEqual(['F', 'G', 'H']);
  });
});
