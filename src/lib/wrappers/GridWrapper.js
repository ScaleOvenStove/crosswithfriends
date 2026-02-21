/* eslint no-continue: "off", no-underscore-dangle: "off" */
import _ from 'lodash';
// eslint-disable-next-line import/no-cycle
import * as gameUtils from '../gameUtils';

function safe_while(condition, step, cap = 500) {
  let remaining = cap;
  while (condition() && remaining >= 0) {
    step();
    remaining -= 1;
  }
}

export default class GridWrapper {
  constructor(grid) {
    this.grid = grid;
    if (!grid) {
      throw new Error('Attempting to wrap an undefined grid object.');
    }
    if (!_.isArray(grid)) {
      throw new Error(`Invalid type for grid object: ${typeof grid}`);
    }
  }

  get clueLengths() {
    const result = {
      across: [],
      down: [],
    };
    this.values().forEach((cell) => {
      if (cell && !cell.black) {
        ['across', 'down'].forEach((dir) => {
          result[dir][cell.parents[dir]] = (result[dir][cell.parents[dir]] || 0) + 1;
        });
      }
    });
    return result;
  }

  get size() {
    return this.grid.length;
  }

  get rows() {
    return this.grid.length;
  }

  get cols() {
    return this.grid[0].length;
  }

  keys() {
    const keys = [];
    for (const r of _.range(0, this.grid.length)) {
      for (const c of _.range(0, this.grid[r].length)) {
        keys.push([r, c]);
      }
    }
    return keys;
  }

  values() {
    const values = [];
    for (const r of _.range(0, this.grid.length)) {
      for (const c of _.range(0, this.grid[r].length)) {
        values.push(this.grid[r][c]);
      }
    }
    return values;
  }

  items() {
    const items = [];
    for (const r of _.range(0, this.grid.length)) {
      for (const c of _.range(0, this.grid[r].length)) {
        items.push([r, c, this.grid[r][c]]);
      }
    }
    return items;
  }

  isSolved(solution) {
    for (const [r, c, cell] of this.items()) {
      if (solution[r][c] !== '.' && solution[r][c] !== cell.value) {
        return false;
      }
    }
    return true;
  }

  isGridFilled() {
    for (const cell of this.values()) {
      if (!cell.black && cell.value === '') {
        return false;
      }
    }
    return true;
  }

  getNextCell(r, c, direction) {
    let row = r;
    let col = c;
    if (direction === 'across') {
      col += 1;
    } else {
      row += 1;
    }
    if (this.isWriteable(row, col)) {
      return {r: row, c: col};
    }
    return undefined;
  }

  getPreviousCell(r, c, direction) {
    let row = r;
    let col = c;
    if (direction === 'across') {
      col -= 1;
    } else {
      row -= 1;
    }
    if (this.isWriteable(row, col)) {
      return {r: row, c: col};
    }
    return undefined;
  }

  getEdge(r, c, direction, start = true) {
    let row = r;
    let col = c;
    let dr = 0;
    let dc = 0;

    if (direction === 'across') {
      dc = -1;
    } else {
      dr = -1;
    }
    if (!start) {
      dc = -dc;
      dr = -dr;
    }

    do {
      col += dc;
      row += dr;
    } while (this.isWriteable(row, col));
    col -= dc;
    row -= dr;

    return {r: row, c: col};
  }

  getNextEmptyCell(r, c, direction, options = {}) {
    const _r = r;
    const _c = c;
    let row = r;
    let col = c;
    const {noWraparound = false, skipFirst = false, skipFilledSquares = true} = options;
    let shouldSkipFirst = skipFirst;

    while (this.isWriteable(row, col)) {
      if (skipFilledSquares && !this.isFilled(row, col)) {
        if (!shouldSkipFirst) {
          return {r: row, c: col};
        }
      }
      shouldSkipFirst = false;
      if (direction === 'across') {
        col += 1;
      } else {
        row += 1;
      }
    }

    if (!noWraparound) {
      const edge = this.getEdge(row, col, direction);
      row = edge.r;
      col = edge.c;

      // recurse but not infinitely
      const result = this.getNextEmptyCell(row, col, direction, {
        noWraparound: true,
        skipFilledSquares,
      });
      if (!result || (result.r === _r && result.c === _c)) return undefined;
      return result;
    }
    return undefined;
  }

  hasEmptyCells(r, c, direction) {
    return this.getNextEmptyCell(r, c, direction) !== undefined;
  }

  isWordFilled(direction, number) {
    const clueRoot = this.getCellByNumber(number);
    return !this.hasEmptyCells(clueRoot.r, clueRoot.c, direction);
  }

  getNextClue(clueNumber, direction, clues, backwards, parallel, skipFilledSquares) {
    let currentClueNumber = parallel ? this.parallelMap[direction][clueNumber] : clueNumber;
    let currentDirection = direction;
    const add = backwards ? -1 : 1;
    const start = () => (backwards ? clues[currentDirection].length - 1 : 1);
    const step = () => {
      if (currentClueNumber + add < clues[currentDirection].length && currentClueNumber + add >= 0) {
        currentClueNumber += add;
      } else {
        currentDirection = gameUtils.getOppositeDirection(currentDirection);
        currentClueNumber = start();
      }
    };
    const ok = () => {
      const number = parallel
        ? this.parallelMapInverse[currentDirection][currentClueNumber]
        : currentClueNumber;
      return (
        clues[currentDirection][number] !== undefined &&
        (this.isGridFilled() || !skipFilledSquares || !this.isWordFilled(currentDirection, number))
      );
    };
    step();

    safe_while(() => !ok(), step);
    const number = parallel
      ? this.parallelMapInverse[currentDirection][currentClueNumber]
      : currentClueNumber;
    return {
      direction: currentDirection,
      clueNumber: number,
    };
  }

  getWritableLocations() {
    const writableLocations = [];

    _.forEach(_.range(this.grid.length), (i) => {
      _.forEach(_.range(this.grid[0].length), (j) => {
        if (this.isWriteable(i, j)) {
          writableLocations.push({i, j});
        }
      });
    });

    return writableLocations;
  }

  getCrossingWords(r, c) {
    const writableLocations = this.getWritableLocations();
    const isSameWord = (direction) => ({i, j}) =>
      this.getParent(r, c, direction) === this.getParent(i, j, direction);

    const across = _.filter(writableLocations, isSameWord('across'));
    const down = _.filter(writableLocations, isSameWord('down'));
    return {across, down};
  }

  getPossiblePickupLocations(solution) {
    const writableLocations = this.getWritableLocations();
    const isCorrect = (cells) => _.every(cells, ({i, j}) => this.grid[i][j].value === solution[i][j]);

    return _.filter(writableLocations, ({i, j}) => {
      const {across, down} = this.getCrossingWords(i, j);
      return !isCorrect(across) && !isCorrect(down);
    });
  }

  getCellByNumber(number) {
    if (!this.cellsByNumber) {
      this.computeCellsByNumber();
    }
    return this.cellsByNumber[number];
  }

  fixSelect({r, c}) {
    // Find the next valid white square in line order
    let row = r;
    let col = c;
    while (!this.isWhite(row, col)) {
      if (col + 1 < this.grid[row].length) {
        col += 1;
      } else {
        row += 1;
        col = 0;
      }
    }
    return {r: row, c: col};
  }

  isInBounds(r, c) {
    return r >= 0 && c >= 0 && r < this.grid.length && c < this.grid[r].length;
  }

  isFilled(r, c) {
    return this.grid[r][c].value !== '';
  }

  isWhite(r, c) {
    return !this.grid[r][c].black;
  }

  isHidden(r, c) {
    return this.grid[r][c].isHidden;
  }

  isWriteable(r, c) {
    return this.isInBounds(r, c) && this.isWhite(r, c) && !this.isHidden(r, c);
  }

  getParent(r, c, direction) {
    return this.grid[r][c].parents?.[direction] ?? 0;
  }

  isStartOfClue(r, c, direction) {
    if (!this.isWhite(r, c)) {
      return false;
    }
    if (direction === 'across') {
      return !this.isWriteable(r, c - 1) && this.isWriteable(r, c + 1);
    }
    if (direction === 'down') {
      return !this.isWriteable(r - 1, c) && this.isWriteable(r + 1, c);
    }
    throw new Error(`Invalid direction: ${direction}`);
  }

  isSqueezedSquare(r, c, direction) {
    if (!this.isWhite(r, c)) {
      return false;
    }
    if (direction === 'across') {
      return !this.isWriteable(r, c - 1) && !this.isWriteable(r, c + 1);
    }
    if (direction === 'down') {
      return !this.isWriteable(r - 1, c) && !this.isWriteable(r + 1, c);
    }
    throw new Error(`Invalid direction: ${direction}`);
  }

  assignNumbers() {
    // Mutate the cells in the grid and set the numbers and parents
    // for faster future calculations.
    let nextNumber = 1;
    for (const [r, c, cell] of this.items()) {
      if (!this.isWhite(r, c)) {
        continue;
      } else if (this.isStartOfClue(r, c, 'across') || this.isStartOfClue(r, c, 'down')) {
        cell.number = nextNumber;
        nextNumber += 1;
      } else {
        cell.number = null;
      }

      let acrossParent;
      if (this.isStartOfClue(r, c, 'across')) {
        acrossParent = cell.number;
      } else if (this.isSqueezedSquare(r, c, 'across')) {
        acrossParent = 0;
      } else {
        acrossParent = this.grid[r][c - 1].parents.across;
      }

      let downParent;
      if (this.isStartOfClue(r, c, 'down')) {
        downParent = cell.number;
      } else if (this.isSqueezedSquare(r, c, 'down')) {
        downParent = 0;
      } else {
        downParent = this.grid[r - 1][c].parents.down;
      }

      cell.parents = {
        across: acrossParent,
        down: downParent,
      };
    }
    this.computeCellsByNumber();
  }

  computeCellsByNumber() {
    this.cellsByNumber = {};
    for (const [r, c, cell] of this.items()) {
      if (cell.number) {
        this.cellsByNumber[cell.number] = {r, c};
      }
    }
  }

  alignClues(clues) {
    const result = {
      across: [],
      down: [],
    };
    for (const cell of this.values()) {
      for (const direction of ['across', 'down']) {
        if (!cell.black && cell.parents && cell.parents[direction] === cell.number) {
          result[direction][cell.number] = (clues && clues[direction] && clues[direction][cell.number]) || '';
        }
      }
    }
    return result;
  }

  toArray() {
    return this.grid;
  }

  toTextGrid() {
    return this.grid.map((row) => row.map((cell) => (cell.black ? '.' : cell.value)));
  }
}
