import {describe, it, expect} from 'vitest';
import {getOppositeDirection, GridWrapper, makeGrid} from '../gameUtils.js';

describe('Game Utils', () => {
  describe('getOppositeDirection', () => {
    it('should return "down" for "across"', () => {
      expect(getOppositeDirection('across')).toBe('down');
    });

    it('should return "across" for "down"', () => {
      expect(getOppositeDirection('down')).toBe('across');
    });
  });

  describe('GridWrapper', () => {
    describe('constructor', () => {
      it('should create GridWrapper with valid grid', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.grid).toBe(grid);
      });

      it('should throw error for undefined grid', () => {
        expect(() => new GridWrapper(undefined as never)).toThrow('undefined grid');
      });

      it('should throw error for non-array grid', () => {
        expect(() => new GridWrapper({} as never)).toThrow('Invalid type');
      });
    });

    describe('size and dimensions', () => {
      it('should return correct size', () => {
        const grid = [
          [{black: false, value: '', number: null, parents: {across: 0, down: 0}}],
          [{black: false, value: '', number: null, parents: {across: 0, down: 0}}],
        ];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.size).toBe(2);
        expect(wrapper.rows).toBe(2);
        expect(wrapper.cols).toBe(1);
      });
    });

    describe('isSolved', () => {
      it('should return true when grid matches solution', () => {
        const grid = [
          [
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'B', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const solution = [['A', 'B']];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isSolved(solution)).toBe(true);
      });

      it('should return false when grid does not match solution', () => {
        const grid = [
          [
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'X', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const solution = [['A', 'B']];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isSolved(solution)).toBe(false);
      });

      it('should ignore black cells in solution', () => {
        const grid = [
          [
            {black: true, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const solution: (string | null)[][] = [['.', 'A']];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isSolved(solution)).toBe(true);
      });
    });

    describe('isGridFilled', () => {
      it('should return true when all white cells are filled', () => {
        const grid = [
          [
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'B', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isGridFilled()).toBe(true);
      });

      it('should return false when any white cell is empty', () => {
        const grid = [
          [
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isGridFilled()).toBe(false);
      });

      it('should ignore black cells', () => {
        const grid = [
          [
            {black: true, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isGridFilled()).toBe(true);
      });
    });

    describe('getNextCell', () => {
      it('should return next cell in across direction', () => {
        const grid = [
          [
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        const next = wrapper.getNextCell(0, 0, 'across');
        expect(next).toEqual({r: 0, c: 1});
      });

      it('should return next cell in down direction', () => {
        const grid = [
          [{black: false, value: '', number: null, parents: {across: 0, down: 0}}],
          [{black: false, value: '', number: null, parents: {across: 0, down: 0}}],
        ];
        const wrapper = new GridWrapper(grid);
        const next = wrapper.getNextCell(0, 0, 'down');
        expect(next).toEqual({r: 1, c: 0});
      });

      it('should return undefined when next cell is out of bounds', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        const next = wrapper.getNextCell(0, 0, 'across');
        expect(next).toBeUndefined();
      });
    });

    describe('isInBounds', () => {
      it('should return true for valid coordinates', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isInBounds(0, 0)).toBe(true);
      });

      it('should return false for negative coordinates', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isInBounds(-1, 0)).toBe(false);
        expect(wrapper.isInBounds(0, -1)).toBe(false);
      });

      it('should return false for out of bounds coordinates', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isInBounds(1, 0)).toBe(false);
        expect(wrapper.isInBounds(0, 1)).toBe(false);
      });
    });

    describe('isWhite', () => {
      it('should return true for white cells', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isWhite(0, 0)).toBe(true);
      });

      it('should return false for black cells', () => {
        const grid = [[{black: true, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isWhite(0, 0)).toBe(false);
      });
    });

    describe('isWriteable', () => {
      it('should return true for white cells in bounds', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isWriteable(0, 0)).toBe(true);
      });

      it('should return false for black cells', () => {
        const grid = [[{black: true, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isWriteable(0, 0)).toBe(false);
      });

      it('should return false for out of bounds cells', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.isWriteable(1, 0)).toBe(false);
      });
    });

    describe('assignNumbers', () => {
      it('should assign numbers to clue starts', () => {
        const grid = [
          [
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
          ],
          [
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: '', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        wrapper.assignNumbers();
        // First cell should be numbered
        expect(grid[0][0].number).toBe(1);
      });
    });

    describe('alignClues', () => {
      it('should align clues to numbered cells', () => {
        const grid = [
          [
            {
              black: false,
              value: '',
              number: 1,
              parents: {across: 1, down: 1},
            },
            {black: false, value: '', number: null, parents: {across: 1, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        const clues = {
          across: ['', 'First clue'],
          down: ['', 'Second clue'],
        };
        const aligned = wrapper.alignClues(clues);
        expect(aligned.across[1]).toBe('First clue');
        expect(aligned.down[1]).toBe('Second clue');
      });
    });

    describe('toArray', () => {
      it('should return the grid array', () => {
        const grid = [[{black: false, value: '', number: null, parents: {across: 0, down: 0}}]];
        const wrapper = new GridWrapper(grid);
        expect(wrapper.toArray()).toBe(grid);
      });
    });

    describe('toTextGrid', () => {
      it('should convert grid to text representation', () => {
        const grid = [
          [
            {black: true, value: '', number: null, parents: {across: 0, down: 0}},
            {black: false, value: 'A', number: null, parents: {across: 0, down: 0}},
          ],
        ];
        const wrapper = new GridWrapper(grid);
        const textGrid = wrapper.toTextGrid();
        expect(textGrid).toEqual([['.', 'A']]);
      });
    });
  });

  describe('makeGrid', () => {
    it('should create GridWrapper from text grid', () => {
      const textGrid = [
        ['.', 'A', 'B'],
        ['.', 'C', 'D'],
      ];
      const grid = makeGrid(textGrid);
      expect(grid).toBeInstanceOf(GridWrapper);
      expect(grid.rows).toBe(2);
      expect(grid.cols).toBe(3);
    });

    it('should mark dots as black cells', () => {
      const textGrid = [['.', 'A']];
      const grid = makeGrid(textGrid);
      const gridArray = grid.toArray();
      expect(gridArray[0][0].black).toBe(true);
      expect(gridArray[0][1].black).toBe(false);
    });

    it('should initialize empty values', () => {
      const textGrid = [['.', 'A']];
      const grid = makeGrid(textGrid);
      const gridArray = grid.toArray();
      expect(gridArray[0][0].value).toBe('');
      expect(gridArray[0][1].value).toBe('');
    });

    it('should assign numbers to clue starts', () => {
      const textGrid = [
        ['.', 'A', 'B'],
        ['.', 'C', 'D'],
      ];
      const grid = makeGrid(textGrid);
      const gridArray = grid.toArray();
      // First white cell should be numbered
      expect(gridArray[0][1].number).toBe(1);
    });

    it('should handle empty grid', () => {
      const textGrid: string[][] = [];
      const grid = makeGrid(textGrid);
      expect(grid.rows).toBe(0);
    });

    it('should handle single cell grid', () => {
      const textGrid = [['A']];
      const grid = makeGrid(textGrid);
      expect(grid.rows).toBe(1);
      expect(grid.cols).toBe(1);
      expect(grid.toArray()[0][0].black).toBe(false);
    });

    it('should handle all black cells', () => {
      const textGrid = [
        ['.', '.'],
        ['.', '.'],
      ];
      const grid = makeGrid(textGrid);
      const gridArray = grid.toArray();
      expect(gridArray[0][0].black).toBe(true);
      expect(gridArray[0][1].black).toBe(true);
      expect(gridArray[1][0].black).toBe(true);
      expect(gridArray[1][1].black).toBe(true);
    });
  });
});
