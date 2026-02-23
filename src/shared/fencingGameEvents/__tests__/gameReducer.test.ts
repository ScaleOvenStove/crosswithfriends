import gameReducer from '../gameReducer';
import {initialState} from '../initialState';
import {GameState} from '../types/GameState';
import {CellData, GameJson} from '../../types';

// Helper: build a minimal 3x3 game with two players on two teams
function make3x3Game(): GameJson {
  const makeCell = (across: number, down: number): CellData => ({
    value: '',
    parents: {across, down},
  });
  return {
    info: {title: 'Test Puzzle', author: 'Tester', copyright: '', description: ''},
    grid: [
      [makeCell(0, 0), makeCell(0, 1), makeCell(0, 2)],
      [makeCell(1, 0), makeCell(1, 1), makeCell(1, 2)],
      [makeCell(2, 0), makeCell(2, 1), makeCell(2, 2)],
    ],
    solution: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ],
    clues: {
      across: ['clue-a1', 'clue-a2', 'clue-a3'],
      down: ['clue-d1', 'clue-d2', 'clue-d3'],
    },
  };
}

function createGame(): GameState {
  return gameReducer(initialState, {
    type: 'create',
    params: {pid: 'test-puzzle', game: make3x3Game()},
  });
}

function createGameWithPlayers(): GameState {
  let state = createGame();
  state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'p1', displayName: 'Alice'}});
  state = gameReducer(state, {type: 'updateTeamId', params: {id: 'p1', teamId: 1}});
  state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'p2', displayName: 'Bob'}});
  state = gameReducer(state, {type: 'updateTeamId', params: {id: 'p2', teamId: 2}});
  return state;
}

// ============================== gameReducer basics ==============================

describe('gameReducer basics', () => {
  it('returns initialState when state is null', () => {
    const result = gameReducer(null as any, {type: 'unknown' as any, params: {}});
    expect(result.loaded).toBe(false);
    expect(result.started).toBe(false);
  });

  it('returns current state when event is null', () => {
    const state = createGame();
    const result = gameReducer(state, null as any);
    expect(result).toBe(state);
  });

  it('returns current state for unknown event type', () => {
    const state = createGame();
    const spy = jest.spyOn(console, 'warn').mockImplementation();
    const result = gameReducer(state, {type: 'nonexistent_event' as any, params: {}});
    expect(result).toBe(state);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ============================== create ==============================

describe('create', () => {
  it('sets loaded to true', () => {
    const state = createGame();
    expect(state.loaded).toBe(true);
  });

  it('creates teamGrids with entries for team 1 and team 2', () => {
    const state = createGame();
    expect(state.game!.teamGrids).toBeDefined();
    expect(state.game!.teamGrids![1]).toBeDefined();
    expect(state.game!.teamGrids![2]).toBeDefined();
  });

  it('creates teamClueVisibility', () => {
    const state = createGame();
    expect(state.game!.teamClueVisibility).toBeDefined();
    expect(state.game!.teamClueVisibility![1]).toBeDefined();
    expect(state.game!.teamClueVisibility![2]).toBeDefined();
    expect(state.game!.teamClueVisibility![1].across).toBeInstanceOf(Array);
    expect(state.game!.teamClueVisibility![1].down).toBeInstanceOf(Array);
  });

  it('initializes clue visibility arrays with at least some clues visible', () => {
    const state = createGame();
    const vis1 = state.game!.teamClueVisibility![1];
    const vis2 = state.game!.teamClueVisibility![2];
    const team1Visible = vis1.across.filter(Boolean).length + vis1.down.filter(Boolean).length;
    const team2Visible = vis2.across.filter(Boolean).length + vis2.down.filter(Boolean).length;
    // With a 3x3 grid (6 clues total), all should be visible since < MIN_CLUES
    expect(team1Visible).toBeGreaterThan(0);
    expect(team2Visible).toBeGreaterThan(0);
  });
});

// ============================== updateDisplayName ==============================

describe('updateDisplayName', () => {
  it('creates user entry with id and displayName', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'user-1', displayName: 'Alice'}});
    expect(state.users['user-1']).toBeDefined();
    expect(state.users['user-1'].displayName).toBe('Alice');
    expect(state.users['user-1'].id).toBe('user-1');
  });

  it('updates existing user displayName', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'user-1', displayName: 'Alice'}});
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'user-1', displayName: 'Bob'}});
    expect(state.users['user-1'].displayName).toBe('Bob');
  });
});

// ============================== updateTeamId ==============================

describe('updateTeamId', () => {
  it('sets teamId for existing user', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'u1', displayName: 'Test'}});
    state = gameReducer(state, {type: 'updateTeamId', params: {id: 'u1', teamId: 1}});
    expect(state.users.u1.teamId).toBe(1);
  });

  it('allows teamId 0 (spectator)', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'u1', displayName: 'Test'}});
    state = gameReducer(state, {type: 'updateTeamId', params: {id: 'u1', teamId: 0}});
    expect(state.users.u1.teamId).toBe(0);
  });

  it('rejects invalid teamId (3)', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'u1', displayName: 'Test'}});
    const before = state;
    state = gameReducer(state, {type: 'updateTeamId', params: {id: 'u1', teamId: 3}});
    expect(state).toBe(before);
  });

  it('rejects update for non-existent user', () => {
    const state = createGame();
    const result = gameReducer(state, {type: 'updateTeamId', params: {id: 'nobody', teamId: 1}});
    expect(result).toBe(state);
  });
});

// ============================== updateCursor ==============================

describe('updateCursor', () => {
  it('sets cursor on existing user', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'u1', displayName: 'Test'}});
    state = gameReducer(state, {
      type: 'updateCursor',
      params: {id: 'u1', cell: {r: 1, c: 2}, timestamp: 12345},
    });
    expect(state.users.u1.cursor).toBeDefined();
    expect(state.users.u1.cursor!.r).toBe(1);
    expect(state.users.u1.cursor!.c).toBe(2);
  });

  it('rejects update for non-existent user', () => {
    const state = createGame();
    const result = gameReducer(state, {
      type: 'updateCursor',
      params: {id: 'nobody', cell: {r: 0, c: 0}, timestamp: 1},
    });
    expect(result).toBe(state);
  });
});

// ============================== updateTeamName ==============================

describe('updateTeamName', () => {
  it('updates team name for valid team', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateTeamName', params: {teamId: '1', teamName: 'Awesome Team'}});
    expect(state.teams['1']!.name).toBe('Awesome Team');
  });

  it('throws for non-existent team', () => {
    const state = createGame();
    expect(() => {
      gameReducer(state, {type: 'updateTeamName', params: {teamId: '99', teamName: 'Bad Team'}});
    }).toThrow();
  });
});

// ============================== startGame ==============================

describe('startGame', () => {
  it('sets started to true', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'startGame', params: {}, timestamp: 1000});
    expect(state.started).toBe(true);
  });

  it('sets startedAt to the event timestamp', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'startGame', params: {}, timestamp: 42000});
    expect(state.startedAt).toBe(42000);
  });
});

// ============================== sendChatMessage ==============================

describe('sendChatMessage', () => {
  it('appends message to chat.messages', () => {
    let state = createGame();
    state = gameReducer(state, {
      type: 'sendChatMessage',
      params: {id: 'u1', message: 'hello'},
      timestamp: 1000,
    });
    expect(state.chat.messages).toHaveLength(1);
    expect(state.chat.messages[0].text).toBe('hello');
    expect(state.chat.messages[0].senderId).toBe('u1');
  });

  it('message includes timestamp', () => {
    let state = createGame();
    state = gameReducer(state, {
      type: 'sendChatMessage',
      params: {id: 'u1', message: 'hi'},
      timestamp: 5000,
    });
    expect(state.chat.messages[0].timestamp).toBe(5000);
  });
});

// ============================== updateCell ==============================

describe('updateCell', () => {
  it('updates cell value in the player team grid', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    expect(state.game!.teamGrids![1][0][0].value).toBe('A');
  });

  it('clears bad flag when setting a new value', () => {
    let state = createGameWithPlayers();
    // Manually mark a cell as bad by checking with wrong value
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'Z', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].bad).toBe(true);
    // Now update with new value — bad should be cleared
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    expect(state.game!.teamGrids![1][0][0].bad).toBe(false);
  });

  it('does NOT update if player is not on a team', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'noteam', displayName: 'No Team'}});
    // noteam has no teamId set
    const before = state;
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'noteam', cell: {r: 0, c: 0}, value: 'X', autocheck: false},
    });
    expect(state).toBe(before);
  });

  it('does NOT update if cell is already good', () => {
    let state = createGameWithPlayers();
    // Fill correct value and check to make it good
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].good).toBe(true);
    // Try to overwrite
    const before = state;
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'Z', autocheck: false},
    });
    expect(state).toBe(before);
  });

  it('does NOT modify other team grid', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'X', autocheck: false},
    });
    expect(state.game!.teamGrids![1][0][0].value).toBe('X');
    expect(state.game!.teamGrids![2][0][0].value).toBe('');
  });

  it('returns unchanged state for non-existent user', () => {
    const state = createGameWithPlayers();
    const result = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'ghost', cell: {r: 0, c: 0}, value: 'X', autocheck: false},
    });
    expect(result).toBe(state);
  });
});

// ============================== check ==============================

describe('check', () => {
  it('marks correct cell as good on ALL team grids', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    // Both team grids should have the cell marked good
    expect(state.game!.teamGrids![1][0][0].good).toBe(true);
    expect(state.game!.teamGrids![2][0][0].good).toBe(true);
  });

  it('marks correct cell on the main game grid too', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.grid[0][0].good).toBe(true);
  });

  it('sets solvedBy with id and teamId on correct cells', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].solvedBy).toEqual({id: 'p1', teamId: 1});
  });

  it('increments player score on correct check', () => {
    let state = createGameWithPlayers();
    expect(state.users.p1.score || 0).toBe(0);
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.users.p1.score).toBe(1);
  });

  it('increments team score on correct check', () => {
    let state = createGameWithPlayers();
    expect(state.teams['1']!.score).toBe(0);
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.teams['1']!.score).toBe(1);
  });

  it('marks incorrect cell as bad ONLY on the checking team grid', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'Z', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].bad).toBe(true);
    expect(state.game!.teamGrids![2][0][0].bad).toBeFalsy();
  });

  it('increments player misses on incorrect check', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'Z', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.users.p1.misses).toBe(1);
  });

  it('increments team guesses on incorrect check', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'Z', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.teams['1']!.guesses).toBe(1);
  });

  it('rejects check when scope has more than 1 cell', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    const before = state;
    state = gameReducer(state, {
      type: 'check',
      params: {
        id: 'p1',
        scope: [
          {r: 0, c: 0},
          {r: 0, c: 1},
        ],
      },
    });
    expect(state).toBe(before);
  });

  it('rejects check on empty cell (no value filled)', () => {
    let state = createGameWithPlayers();
    const before = state;
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state).toBe(before);
  });

  it('rejects check on already-good cell', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    const before = state;
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state).toBe(before);
  });

  it('updates teamClueVisibility for the checking team on correct check', () => {
    let state = createGameWithPlayers();
    const acrossIdx = state.game!.teamGrids![1][0][0].parents!.across;
    const downIdx = state.game!.teamGrids![1][0][0].parents!.down;

    state = gameReducer(state, {
      type: 'updateCell',
      params: {id: 'p1', cell: {r: 0, c: 0}, value: 'A', autocheck: false},
    });
    state = gameReducer(state, {type: 'check', params: {id: 'p1', scope: [{r: 0, c: 0}]}});

    expect(state.game!.teamClueVisibility![1].across[acrossIdx]).toBe(true);
    expect(state.game!.teamClueVisibility![1].down[downIdx]).toBe(true);
  });

  it('returns unchanged state when user has no team', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'noteam', displayName: 'No Team'}});
    const before = state;
    state = gameReducer(state, {type: 'check', params: {id: 'noteam', scope: [{r: 0, c: 0}]}});
    expect(state).toBe(before);
  });
});

// ============================== reveal ==============================

describe('reveal', () => {
  it('sets cell to solution value with good and revealed flags', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 1, c: 1}]}});
    expect(state.game!.teamGrids![1][1][1].value).toBe('E');
    expect(state.game!.teamGrids![1][1][1].good).toBe(true);
    expect(state.game!.teamGrids![1][1][1].revealed).toBe(true);
  });

  it('sets solvedBy on revealed cell', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].solvedBy).toEqual({id: 'p1', teamId: 1});
  });

  it('updates ALL team grids (revealed answer is shared)', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamGrids![1][0][0].good).toBe(true);
    expect(state.game!.teamGrids![2][0][0].good).toBe(true);
    expect(state.game!.grid[0][0].good).toBe(true);
  });

  it('increments player score and team score', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {type: 'reveal', params: {id: 'p2', scope: [{r: 0, c: 0}]}});
    expect(state.users.p2.score).toBe(1);
    expect(state.teams['2']!.score).toBe(1);
  });

  it('updates teamClueVisibility for across and down parents', () => {
    let state = createGameWithPlayers();
    const acrossIdx = state.game!.teamGrids![1][0][0].parents!.across;
    const downIdx = state.game!.teamGrids![1][0][0].parents!.down;

    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state.game!.teamClueVisibility![1].across[acrossIdx]).toBe(true);
    expect(state.game!.teamClueVisibility![1].down[downIdx]).toBe(true);
  });

  it('rejects reveal on already-good cell', () => {
    let state = createGameWithPlayers();
    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    const before = state;
    state = gameReducer(state, {type: 'reveal', params: {id: 'p1', scope: [{r: 0, c: 0}]}});
    expect(state).toBe(before);
  });

  it('rejects reveal when scope has more than 1 cell', () => {
    let state = createGameWithPlayers();
    const before = state;
    state = gameReducer(state, {
      type: 'reveal',
      params: {
        id: 'p1',
        scope: [
          {r: 0, c: 0},
          {r: 0, c: 1},
        ],
      },
    });
    expect(state).toBe(before);
  });

  it('returns unchanged state when user has no team', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'updateDisplayName', params: {id: 'noteam', displayName: 'No'}});
    const before = state;
    state = gameReducer(state, {type: 'reveal', params: {id: 'noteam', scope: [{r: 0, c: 0}]}});
    expect(state).toBe(before);
  });
});

// ============================== revealAllClues ==============================

describe('revealAllClues', () => {
  it('sets all clue visibility to true for both teams', () => {
    let state = createGame();
    state = gameReducer(state, {type: 'revealAllClues', params: {}});
    const vis1 = state.game!.teamClueVisibility![1];
    const vis2 = state.game!.teamClueVisibility![2];
    expect(vis1.across.every(Boolean)).toBe(true);
    expect(vis1.down.every(Boolean)).toBe(true);
    expect(vis2.across.every(Boolean)).toBe(true);
    expect(vis2.down.every(Boolean)).toBe(true);
  });

  it('returns unchanged state when game is null', () => {
    const result = gameReducer(initialState, {type: 'revealAllClues', params: {}});
    expect(result).toBe(initialState);
  });
});
