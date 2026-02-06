import {getOppositeDirection, GridWrapper, makeGrid} from '../../server/gameUtils';

// Helper: build a small 3x3 grid with a black square at (0,0)
// Layout:
//   .  A  B
//   C  D  E
//   F  G  H
function make3x3() {
  const textGrid = [
    ['.', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];
  return makeGrid(textGrid);
}

describe('getOppositeDirection', () => {
  it('returns down for across', () => {
    expect(getOppositeDirection('across')).toBe('down');
  });

  it('returns across for down', () => {
    expect(getOppositeDirection('down')).toBe('across');
  });

  it('returns undefined for unknown direction', () => {
    expect(getOppositeDirection('diagonal')).toBeUndefined();
  });
});

describe('GridWrapper construction', () => {
  it('throws on undefined grid', () => {
    expect(() => new GridWrapper(undefined)).toThrow('Attempting to wrap an undefined grid object');
  });

  it('throws on non-array grid', () => {
    expect(() => new GridWrapper('not an array')).toThrow('Invalid type for grid object');
  });
});

describe('GridWrapper with 3x3 grid', () => {
  let grid;

  beforeEach(() => {
    grid = make3x3();
  });

  describe('dimensions', () => {
    it('has correct rows', () => {
      expect(grid.rows).toBe(3);
    });

    it('has correct cols', () => {
      expect(grid.cols).toBe(3);
    });

    it('size equals rows', () => {
      expect(grid.size).toBe(3);
    });
  });

  describe('isInBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(grid.isInBounds(0, 0)).toBe(true);
      expect(grid.isInBounds(2, 2)).toBe(true);
    });

    it('returns false for negative coordinates', () => {
      expect(grid.isInBounds(-1, 0)).toBe(false);
      expect(grid.isInBounds(0, -1)).toBe(false);
    });

    it('returns false for out-of-bounds coordinates', () => {
      expect(grid.isInBounds(3, 0)).toBe(false);
      expect(grid.isInBounds(0, 3)).toBe(false);
    });
  });

  describe('isWhite / isWriteable', () => {
    it('black square is not white', () => {
      expect(grid.isWhite(0, 0)).toBe(false);
    });

    it('white square is white', () => {
      expect(grid.isWhite(0, 1)).toBe(true);
    });

    it('black square is not writeable', () => {
      expect(grid.isWriteable(0, 0)).toBe(false);
    });

    it('white square is writeable', () => {
      expect(grid.isWriteable(1, 1)).toBe(true);
    });

    it('out-of-bounds is not writeable', () => {
      expect(grid.isWriteable(-1, 0)).toBe(false);
    });
  });

  describe('assignNumbers', () => {
    it('assigns clue numbers to start-of-clue cells', () => {
      // (0,0) is black — no number
      // (0,1) starts 1-across and 1-down
      // (0,2) starts 2-down
      // (1,0) starts 3-across and continues 3-down? Let's verify
      const cell01 = grid.toArray()[0][1];
      const cell02 = grid.toArray()[0][2];
      const cell10 = grid.toArray()[1][0];

      expect(cell01.number).toBe(1);
      expect(cell02.number).toBe(2);
      expect(cell10.number).toBe(3);
    });

    it('non-start cells have null number', () => {
      // (1,1) is in the middle — not start of any clue
      const cell11 = grid.toArray()[1][1];
      expect(cell11.number).toBeNull();
    });
  });

  describe('getCellByNumber', () => {
    it('finds cell by clue number', () => {
      const result = grid.getCellByNumber(1);
      expect(result).toEqual({r: 0, c: 1});
    });

    it('returns undefined for non-existent number', () => {
      expect(grid.getCellByNumber(99)).toBeUndefined();
    });
  });

  describe('isStartOfClue', () => {
    it('(0,1) starts an across clue', () => {
      expect(grid.isStartOfClue(0, 1, 'across')).toBe(true);
    });

    it('(0,2) does not start an across clue (no cell to the right)', () => {
      expect(grid.isStartOfClue(0, 2, 'across')).toBe(false);
    });

    it('(0,1) starts a down clue', () => {
      expect(grid.isStartOfClue(0, 1, 'down')).toBe(true);
    });

    it('black square is not start of clue', () => {
      expect(grid.isStartOfClue(0, 0, 'across')).toBe(false);
    });
  });

  describe('isFilled / isGridFilled', () => {
    it('empty grid is not filled', () => {
      expect(grid.isGridFilled()).toBe(false);
    });

    it('isFilled returns false for empty white cell', () => {
      expect(grid.isFilled(0, 1)).toBe(false);
    });

    it('filled grid reports as filled', () => {
      // Fill all white cells
      for (const [, , cell] of grid.items()) {
        if (!cell.black) {
          cell.value = 'X';
        }
      }
      expect(grid.isGridFilled()).toBe(true);
    });
  });

  describe('isSolved', () => {
    it('empty grid is not solved', () => {
      const solution = [
        ['.', 'A', 'B'],
        ['C', 'D', 'E'],
        ['F', 'G', 'H'],
      ];
      expect(grid.isSolved(solution)).toBe(false);
    });

    it('correctly filled grid is solved', () => {
      const solution = [
        ['.', 'A', 'B'],
        ['C', 'D', 'E'],
        ['F', 'G', 'H'],
      ];
      const letters = [
        [null, 'A', 'B'],
        ['C', 'D', 'E'],
        ['F', 'G', 'H'],
      ];
      for (const [r, c, cell] of grid.items()) {
        if (!cell.black) {
          cell.value = letters[r][c];
        }
      }
      expect(grid.isSolved(solution)).toBe(true);
    });

    it('incorrectly filled grid is not solved', () => {
      const solution = [
        ['.', 'A', 'B'],
        ['C', 'D', 'E'],
        ['F', 'G', 'H'],
      ];
      for (const [, , cell] of grid.items()) {
        if (!cell.black) {
          cell.value = 'Z';
        }
      }
      expect(grid.isSolved(solution)).toBe(false);
    });
  });

  describe('toTextGrid', () => {
    it('returns grid with dots for black squares and values for white', () => {
      const result = grid.toTextGrid();
      expect(result[0][0]).toBe('.');
      expect(result[0][1]).toBe('');
      expect(result[1][0]).toBe('');
    });

    it('reflects cell values', () => {
      grid.toArray()[0][1].value = 'A';
      const result = grid.toTextGrid();
      expect(result[0][1]).toBe('A');
    });
  });

  describe('keys / values / items', () => {
    it('keys returns all coordinate pairs', () => {
      const keys = grid.keys();
      expect(keys).toHaveLength(9);
      expect(keys[0]).toEqual([0, 0]);
      expect(keys[8]).toEqual([2, 2]);
    });

    it('values returns all cells', () => {
      const values = grid.values();
      expect(values).toHaveLength(9);
      expect(values[0].black).toBe(true);
      expect(values[1].black).toBe(false);
    });

    it('items returns [r, c, cell] tuples', () => {
      const items = grid.items();
      expect(items).toHaveLength(9);
      expect(items[0][0]).toBe(0);
      expect(items[0][1]).toBe(0);
      expect(items[0][2].black).toBe(true);
    });
  });
});
