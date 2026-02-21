import _ from 'lodash';

function safe_while(condition, step, cap = 500) {
  let i = 0;
  while (condition()) {
    step();
    i += 1;
    if (i > cap) {
      throw new Error('Condition never became falsey!');
    }
  }
}

export const getOppositeDirection = (direction) =>
  ({
    across: 'down',
    down: 'across',
  }[direction]);

export class GridWrapper {
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
    let nextR = r;
    let nextC = c;
    if (direction === 'across') {
      nextC += 1;
    } else {
      nextR += 1;
    }
    if (this.isWriteable(nextR, nextC)) {
      return {r: nextR, c: nextC};
    }
    return undefined;
  }

  getNextEmptyCell(r, c, direction, options = {}) {
    const origR = r;
    const origC = c;
    let curR = r;
    let curC = c;
    const {noWraparound = false} = options;
    let shouldSkipFirst = options.skipFirst || false;

    while (this.isWriteable(curR, curC)) {
      if (!this.isFilled(curR, curC)) {
        if (!shouldSkipFirst) {
          return {r: curR, c: curC};
        }
      }
      shouldSkipFirst = false;
      if (direction === 'across') {
        curC += 1;
      } else {
        curR += 1;
      }
    }

    if (!noWraparound) {
      // move to start of word
      do {
        if (direction === 'across') {
          curC -= 1;
        } else {
          curR -= 1;
        }
      } while (this.isWriteable(curR, curC));
      if (direction === 'across') {
        curC += 1;
      } else {
        curR += 1;
      }

      // recurse but not infinitely
      const result = this.getNextEmptyCell(curR, curC, direction, {
        noWraparound: true,
      });
      if (!result || (result.r === origR && result.c === origC)) return undefined;
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

  getNextClue(clueNumber, direction, clues, backwards, parallel) {
    let curClueNumber = parallel ? this.parallelMap[direction][clueNumber] : clueNumber;
    let curDirection = direction;
    const add = backwards ? -1 : 1;
    const start = () => (backwards ? clues[curDirection].length - 1 : 1);
    const step = () => {
      if (curClueNumber + add < clues[curDirection].length && curClueNumber + add >= 0) {
        curClueNumber += add;
      } else {
        curDirection = getOppositeDirection(curDirection);
        curClueNumber = start();
      }
    };
    const ok = () => {
      const number = parallel ? this.parallelMapInverse[curDirection][curClueNumber] : curClueNumber;
      return (
        clues[curDirection][number] !== undefined &&
        (this.isGridFilled() || !this.isWordFilled(curDirection, number))
      );
    };
    step();

    safe_while(() => !ok(), step);
    const number = parallel ? this.parallelMapInverse[curDirection][curClueNumber] : curClueNumber;
    return {
      direction: curDirection,
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
    for (const [r, c, cell] of this.items()) {
      if (cell.number === number) {
        return {r, c};
      }
    }
    return undefined;
  }

  fixSelect({r, c}) {
    // Find the next valid white square in line order
    let curR = r;
    let curC = c;
    while (!this.isWhite(curR, curC)) {
      if (curC + 1 < this.grid[curR].length) {
        curC += 1;
      } else {
        curR += 1;
        curC = 0;
      }
    }
    return {r: curR, c: curC};
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

  isWriteable(r, c) {
    return this.isInBounds(r, c) && this.isWhite(r, c);
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
        // eslint-disable-next-line no-continue
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

export const makeGrid = (textGrid) => {
  const newGridArray = textGrid.map((row) =>
    row.map((cell) => ({
      black: cell === '.',
      edits: [],
      value: '',
      number: null,
    }))
  );
  const grid = new GridWrapper(newGridArray);
  grid.assignNumbers();
  return grid;
};
