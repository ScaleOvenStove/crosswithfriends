/**
 * Mock game data for e2e tests
 */

export const mockPuzzleData = {
  pid: 'test-puzzle-id',
  title: 'Test Crossword Puzzle',
  author: 'Test Author',
  date: '2024-01-01',
  size: {
    rows: 5,
    cols: 5,
  },
  grid: [
    ['A', 'C', 'R', 'O', 'S'],
    ['C', 'L', 'U', 'E', 'S'],
    ['R', 'O', 'W', 'S', 'T'],
    ['O', 'N', 'E', 'T', 'W'],
    ['S', 'S', 'T', 'W', 'O'],
  ],
  gridnums: [
    [1, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [4, 0, 0, 0, 0],
    [5, 0, 0, 0, 0],
  ],
  clues: {
    across: [
      {num: 1, clue: 'Horizontal direction', answer: 'ACROS'},
      {num: 3, clue: 'Horizontal lines', answer: 'ROWST'},
      {num: 5, clue: 'Number after one', answer: 'SSTWO'},
    ],
    down: [
      {num: 1, clue: 'Vertical direction', answer: 'ACROS'},
      {num: 2, clue: 'Hints', answer: 'CLUES'},
    ],
  },
  circles: [],
  shades: [],
};

// Create properly initialized grid cells (empty objects for each cell)
const createEmptyGrid = (rows: number, cols: number) => {
  return Array(rows)
    .fill(null)
    .map(() =>
      Array(cols)
        .fill(null)
        .map(() => ({}))
    );
};

export const mockGameData = {
  gid: 'test-game-id',
  pid: 'test-puzzle-id',
  info: {
    title: 'Test Crossword Puzzle',
    author: 'Test Author',
    date: '2024-01-01',
    pid: 'test-puzzle-id',
  },
  grid: createEmptyGrid(5, 5),
  solution: [
    ['A', 'C', 'R', 'O', 'S'],
    ['C', 'L', 'U', 'E', 'S'],
    ['R', 'O', 'W', 'S', 'T'],
    ['O', 'N', 'E', 'T', 'W'],
    ['S', 'S', 'T', 'W', 'O'],
  ],
  gridnums: [
    [1, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    [3, 0, 0, 0, 0],
    [4, 0, 0, 0, 0],
    [5, 0, 0, 0, 0],
  ],
  clues: {
    across: ['1. Horizontal direction', '3. Horizontal lines', '5. Number after one'],
    down: ['1. Vertical direction', '2. Hints'],
  },
  circles: [],
  shades: [],
  solved: false,
  clock: {
    paused: false,
    totalTime: 0,
    lastUpdated: Date.now(),
  },
  users: {},
  chat: {
    messages: [],
  },
  cursor: {},
};

export const mockBattleData = {
  bid: 'test-battle-id',
  teams: [0, 1],
  games: ['test-game-id', 'test-game-id-2'],
  players: {
    'player-1': {
      name: 'Player 1',
      team: 0,
      color: '#ff0000',
    },
    'player-2': {
      name: 'Player 2',
      team: 1,
      color: '#0000ff',
    },
  },
  startedAt: Date.now(),
  winner: null,
  powerups: {
    0: [],
    1: [],
  },
  pickups: {},
};

export const mockRoomData = {
  rid: 'test-room-id',
  name: 'Test Room',
  games: [],
  users: {},
};

export const mockReplayData = {
  ...mockGameData,
  events: [
    {
      timestamp: Date.now(),
      type: 'cell_update',
      data: {r: 0, c: 0, value: 'A'},
    },
    {
      timestamp: Date.now() + 1000,
      type: 'cell_update',
      data: {r: 0, c: 1, value: 'C'},
    },
  ],
};

export const mockPuzzleList = [
  {
    pid: 'puzzle-1',
    title: 'Monday Puzzle',
    author: 'Test Author 1',
    date: '2024-01-01',
    difficulty: 'Easy',
  },
  {
    pid: 'puzzle-2',
    title: 'Tuesday Puzzle',
    author: 'Test Author 2',
    date: '2024-01-02',
    difficulty: 'Medium',
  },
  {
    pid: 'puzzle-3',
    title: 'Wednesday Puzzle',
    author: 'Test Author 3',
    date: '2024-01-03',
    difficulty: 'Hard',
  },
];
