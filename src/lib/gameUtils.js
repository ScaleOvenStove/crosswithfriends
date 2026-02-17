// eslint-disable-next-line import/no-cycle
import GridWrapper from './wrappers/GridWrapper';

export const getOppositeDirection = (direction) =>
  ({
    across: 'down',
    down: 'across',
  }[direction]);

export const makeEmptyGame = () => ({
  gid: undefined,
  name: undefined,
  info: undefined,
  clues: {
    across: [],
    down: [],
  },
  solution: [['']],
  grid: [
    [
      {
        black: false,
        number: 1,
        edits: [],
        value: '',
        parents: {
          across: 1,
          down: 1,
        },
      },
    ],
  ],
  createTime: undefined,
  startTime: undefined,
  chat: {
    users: [],
    messages: [],
  },
  circles: [],
});

export const makeGrid = (textGrid, fillWithSol) => {
  const newGridArray = textGrid.map((row) =>
    row.map((cell) => ({
      black: cell === '.',
      edits: [],
      value: fillWithSol ? cell : '',
      number: null,
    }))
  );
  const grid = new GridWrapper(newGridArray);
  grid.assignNumbers();
  return grid;
};

export const makeClues = (cluesBySquare, grid) => {
  const result = {
    across: [],
    down: [],
  };
  cluesBySquare.forEach(({r, c, dir, value}) => {
    const num = grid[r][c].number;
    if (num) {
      result[dir][num] = value;
    }
  });
  const alignedResult = new GridWrapper(grid).alignClues(result);
  return alignedResult;
};

export const makeEmptyClues = (gridArray) => {
  const grid = new GridWrapper(gridArray);
  return grid.alignClues({
    across: [],
    down: [],
  });
};

export const allNums = (str) => {
  const pattern = /\d+/g;
  return (str.match(pattern) || []).map((x) => Number(x));
};

export const getReferencedClues = (str, clues) => {
  if (!str) return [];
  let searchText = str.toLowerCase();
  let res = [];
  while (searchText.indexOf('across') !== -1 || searchText.indexOf('down') !== -1) {
    const a = searchText.indexOf('across');
    const b = searchText.indexOf('down');
    if ((a < b || b === -1) && a !== -1) {
      const nums = allNums(searchText.substring(0, a));
      res = res.concat(
        nums.map((num) => ({
          ori: 'across',
          num,
        }))
      );
      searchText = searchText.substr(a + 'across'.length);
    } else {
      const nums = allNums(searchText.substring(0, b));
      res = res.concat(
        nums.map((num) => ({
          ori: 'down',
          num,
        }))
      );
      searchText = searchText.substr(b + 'down'.length);
    }
  }

  const referencesStars =
    searchText.indexOf('starred') !== -1 &&
    (searchText.indexOf('clue') !== -1 ||
      searchText.indexOf('entry') !== -1 ||
      searchText.indexOf('entries') !== -1);
  if (referencesStars) {
    ['down', 'across'].forEach((dir) => {
      clues[dir].forEach((clueText, i) => {
        const hasStar = clueText && (clueText.trim().startsWith('*') || clueText.trim().endsWith('*'));
        if (hasStar) {
          res.push({
            ori: dir,
            num: i,
          });
        }
      });
    });
  }
  return res;
};
