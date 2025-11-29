/**
 * Mock Firebase for e2e tests
 * This mocks the Firebase SDK to return test data instead of connecting to real database
 */

export const createFirebaseMock = (page: any) => {
  return page.addInitScript(() => {
    // Mock Firebase Database methods
    const mockGameData = {
      info: {
        title: 'Test Crossword Puzzle',
        author: 'Test Author',
        date: '2024-01-01',
        pid: 'test-puzzle-id',
      },
      grid: [
        [{}, {}, {}, {}, {}],
        [{}, {}, {}, {}, {}],
        [{}, {}, {}, {}, {}],
        [{}, {}, {}, {}, {}],
        [{}, {}, {}, {}, {}],
      ],
      solution: [
        ['A', 'C', 'R', 'O', 'S'],
        ['C', 'L', 'U', 'E', 'S'],
        ['R', 'O', 'W', 'S', 'T'],
        ['O', 'N', 'E', 'T', 'W'],
        ['S', 'S', 'T', 'W', 'O'],
      ],
      clues: {
        across: ['1. Horizontal direction', '3. Horizontal lines', '5. Number after one'],
        down: ['1. Vertical direction', '2. Hints'],
      },
      gridnums: [
        [1, 0, 0, 0, 0],
        [2, 0, 0, 0, 0],
        [3, 0, 0, 0, 0],
        [4, 0, 0, 0, 0],
        [5, 0, 0, 0, 0],
      ],
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
      pid: 'test-puzzle-id',
      gid: 'test-game-id',
    };

    // Create mock for test game ID
    const mockEvents = [
      {
        id: 'create-event-1',
        type: 'create',
        timestamp: Date.now(),
        params: {
          game: mockGameData,
        },
      },
    ];

    // Store mock data
    (window as any).__MOCK_FIREBASE_DATA__ = {
      'test-game-id': {
        events: mockEvents,
        game: mockGameData,
      },
      'test-game-id-2': {
        events: mockEvents,
        game: {...mockGameData, gid: 'test-game-id-2'},
      },
    };

    // Mock Firebase initialization check
    (window as any).__FIREBASE_MOCKED__ = true;
  });
};
