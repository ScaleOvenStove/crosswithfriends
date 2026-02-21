import {TextEncoder, TextDecoder} from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import iPUZtoJSON from '../iPUZtoJSON';

function makeBuffer(obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).buffer;
}

function makeMinimalIPUZ(overrides = {}) {
  return {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    title: 'Test Puzzle',
    author: 'Test Author',
    notes: 'Test notes',
    puzzle: [
      [{cell: 1}, {cell: 2}],
      [{cell: 3}, '#'],
    ],
    solution: [
      ['A', 'B'],
      ['C', null],
    ],
    clues: {
      Across: [
        [1, 'First across'],
        [3, 'Second across'],
      ],
      Down: [
        [1, 'First down'],
        [2, 'Second down'],
      ],
    },
    ...overrides,
  };
}

describe('iPUZtoJSON', () => {
  it('parses a minimal iPUZ puzzle', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.grid).toBeDefined();
    expect(result.info).toBeDefined();
    expect(result.across).toBeDefined();
    expect(result.down).toBeDefined();
  });

  it('marks puzzle with solution as not contest', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.contest).toBe(false);
  });

  it('converts solution grid correctly', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.grid).toEqual([
      ['A', 'B'],
      ['C', '.'],
    ]);
  });

  it('converts # to . in solution', () => {
    const ipuz = makeMinimalIPUZ({
      solution: [
        ['A', '#'],
        ['B', 'C'],
      ],
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.grid[0][1]).toBe('.');
  });

  it('converts null to . in solution', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.grid[1][1]).toBe('.');
  });

  it('extracts puzzle info', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.info.title).toBe('Test Puzzle');
    expect(result.info.author).toBe('Test Author');
    expect(result.info.description).toBe('Test notes');
  });

  it('defaults missing info fields to empty string', () => {
    const ipuz = makeMinimalIPUZ({title: undefined, author: undefined, notes: undefined});
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.info.title).toBe('');
    expect(result.info.author).toBe('');
    expect(result.info.description).toBe('');
  });

  it('detects Mini Puzzle for small grids', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.info.type).toBe('Mini Puzzle');
  });

  it('detects Daily Puzzle for large grids', () => {
    const bigSolution = Array.from({length: 15}, () => Array(15).fill('A'));
    const bigPuzzle = Array.from({length: 15}, () => Array(15).fill({cell: 0}));
    const ipuz = makeMinimalIPUZ({solution: bigSolution, puzzle: bigPuzzle});
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.info.type).toBe('Daily Puzzle');
  });

  it('parses across and down clues', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.across[1]).toBe('First across');
    expect(result.across[3]).toBe('Second across');
    expect(result.down[1]).toBe('First down');
    expect(result.down[2]).toBe('Second down');
  });

  it('handles object-style clues', () => {
    const ipuz = makeMinimalIPUZ({
      clues: {
        Across: [
          {number: 1, clue: 'Obj across 1'},
          {number: 3, clue: 'Obj across 3'},
        ],
        Down: [
          {number: 1, clue: 'Obj down 1'},
          {number: 2, clue: 'Obj down 2'},
        ],
      },
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.across[1]).toBe('Obj across 1');
    expect(result.down[2]).toBe('Obj down 2');
  });

  it('detects circles from cell styles', () => {
    const ipuz = makeMinimalIPUZ({
      puzzle: [
        [{cell: 1, style: {shapebg: 'circle'}}, {cell: 2}],
        [{cell: 3}, '#'],
      ],
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.circles).toContain(0);
    expect(result.circles).toHaveLength(1);
  });

  it('detects shades from style.color', () => {
    const ipuz = makeMinimalIPUZ({
      puzzle: [
        [{cell: 1, style: {color: 'dcdcdc'}}, {cell: 2}],
        [{cell: 3}, '#'],
      ],
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.shades).toContain(0);
    expect(result.shades).toHaveLength(1);
  });

  it('detects shades from style.highlight', () => {
    const ipuz = makeMinimalIPUZ({
      puzzle: [
        [{cell: 1, style: {highlight: true}}, {cell: 2}],
        [{cell: 3}, '#'],
      ],
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.shades).toContain(0);
    expect(result.shades).toHaveLength(1);
  });

  it('detects both circles and shades on different cells', () => {
    const ipuz = makeMinimalIPUZ({
      puzzle: [
        [
          {cell: 1, style: {shapebg: 'circle'}},
          {cell: 2, style: {highlight: true}},
        ],
        [{cell: 3}, '#'],
      ],
    });
    const result = iPUZtoJSON(makeBuffer(ipuz));
    expect(result.circles).toEqual([0]);
    expect(result.shades).toEqual([1]);
  });

  it('returns empty circles and shades by default', () => {
    const result = iPUZtoJSON(makeBuffer(makeMinimalIPUZ()));
    expect(result.circles).toEqual([]);
    expect(result.shades).toEqual([]);
  });

  describe('missing solution field (contest puzzle)', () => {
    it('does not crash when solution is missing', () => {
      const ipuz = makeMinimalIPUZ();
      delete ipuz.solution;
      expect(() => iPUZtoJSON(makeBuffer(ipuz))).not.toThrow();
    });

    it('marks puzzle as contest when solution is missing', () => {
      const ipuz = makeMinimalIPUZ();
      delete ipuz.solution;
      const result = iPUZtoJSON(makeBuffer(ipuz));
      expect(result.contest).toBe(true);
    });

    it('builds grid from puzzle field with empty white cells', () => {
      const ipuz = makeMinimalIPUZ();
      delete ipuz.solution;
      const result = iPUZtoJSON(makeBuffer(ipuz));
      // White cells become empty strings
      expect(result.grid[0][0]).toBe('');
      expect(result.grid[0][1]).toBe('');
      expect(result.grid[1][0]).toBe('');
      // Black squares still marked correctly
      expect(result.grid[1][1]).toBe('.');
    });

    it('handles object-wrapped black squares in puzzle field', () => {
      const ipuz = makeMinimalIPUZ({
        puzzle: [
          [{cell: 1}, {cell: '#'}],
          [{cell: null}, {cell: 3}],
        ],
      });
      delete ipuz.solution;
      const result = iPUZtoJSON(makeBuffer(ipuz));
      expect(result.grid[0][0]).toBe(''); // white cell
      expect(result.grid[0][1]).toBe('.'); // {cell: '#'} = black
      expect(result.grid[1][0]).toBe('.'); // {cell: null} = black
      expect(result.grid[1][1]).toBe(''); // white cell
    });

    it('still extracts info, clues, and circles', () => {
      const ipuz = makeMinimalIPUZ();
      delete ipuz.solution;
      const result = iPUZtoJSON(makeBuffer(ipuz));
      expect(result.info.title).toBe('Test Puzzle');
      expect(result.across[1]).toBe('First across');
      expect(result.down[1]).toBe('First down');
    });
  });
});
