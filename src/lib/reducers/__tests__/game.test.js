import {reduce, tick} from '../game';
import {MAX_CLOCK_INCREMENT} from '../../timing';

// Helper: create a minimal game state with a 2x2 grid
function makeGame(overrides = {}) {
  return reduce(
    {},
    {
      type: 'create',
      timestamp: 1000,
      params: {
        pid: 'test-puzzle',
        game: {
          grid: [
            [
              {value: '', black: false},
              {value: '', black: false},
            ],
            [
              {value: '', black: false},
              {value: '', black: true},
            ],
          ],
          solution: [
            ['A', 'B'],
            ['C', '.'],
          ],
          clues: {across: [], down: []},
          ...overrides,
        },
      },
    }
  );
}

describe('tick', () => {
  it('returns game unchanged when no timestamp', () => {
    const game = makeGame();
    expect(tick(game, null, false)).toBe(game);
  });

  it('does not accumulate time when paused', () => {
    const game = makeGame();
    // Game starts paused (create sets paused)
    const result = tick(game, 5000, false);
    expect(result.clock.totalTime).toBe(0);
  });

  it('accumulates time when running', () => {
    let game = makeGame();
    // Unpause
    game = tick(game, 2000, false);
    // Now advance time
    game = tick(game, 3000, false);
    expect(game.clock.totalTime).toBe(1000);
  });

  it('caps time increment at MAX_CLOCK_INCREMENT', () => {
    let game = makeGame();
    game = tick(game, 1000, false); // unpause
    // Jump far into the future
    game = tick(game, 1000 + MAX_CLOCK_INCREMENT + 50000, false);
    expect(game.clock.totalTime).toBeLessThanOrEqual(MAX_CLOCK_INCREMENT);
  });

  it('sets paused flag on pause', () => {
    let game = makeGame();
    game = tick(game, 2000, false);
    game = tick(game, 3000, true);
    expect(game.clock.paused).toBe(true);
  });
});

describe('reduce — updateCell', () => {
  it('sets cell value', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'user1'},
    });
    expect(game.grid[0][0].value).toBe('A');
  });

  it('does not update a cell marked as good', () => {
    let game = makeGame();
    game.grid[0][0] = {...game.grid[0][0], good: true, value: 'A'};
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'Z', id: 'user1'},
    });
    expect(game.grid[0][0].value).toBe('A');
  });
});

describe('reduce — check', () => {
  it('marks correct cell as good', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'user1'},
    });
    game = reduce(game, {
      type: 'check',
      timestamp: 3000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].good).toBe(true);
    expect(game.grid[0][0].bad).toBe(false);
  });

  it('marks incorrect cell as bad', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'Z', id: 'user1'},
    });
    game = reduce(game, {
      type: 'check',
      timestamp: 3000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].good).toBe(false);
    expect(game.grid[0][0].bad).toBe(true);
  });

  it('empty cell is not marked good or bad', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'check',
      timestamp: 2000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].good).toBe(false);
    expect(game.grid[0][0].bad).toBe(false);
  });
});

describe('reduce — reveal', () => {
  it('reveals solution value', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'reveal',
      timestamp: 2000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].value).toBe('A');
    expect(game.grid[0][0].good).toBe(true);
    expect(game.grid[0][0].revealed).toBe(true);
  });

  it('does not mark already-correct cell as revealed', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'user1'},
    });
    game = reduce(game, {
      type: 'reveal',
      timestamp: 3000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].revealed).toBe(false);
  });
});

describe('reduce — reset', () => {
  it('clears cell values', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'user1'},
    });
    game = reduce(game, {
      type: 'reset',
      timestamp: 3000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].value).toBe('');
    expect(game.grid[0][0].good).toBe(false);
    expect(game.grid[0][0].bad).toBe(false);
  });
});

describe('reduce — chat', () => {
  it('appends a message', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'chat',
      timestamp: 2000,
      params: {text: 'hello', senderId: 'u1', sender: 'Alice'},
    });
    expect(game.chat.messages).toHaveLength(1);
    expect(game.chat.messages[0].text).toBe('hello');
    expect(game.chat.messages[0].sender).toBe('Alice');
  });

  it('appends multiple messages in order', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'chat',
      timestamp: 2000,
      params: {text: 'first', senderId: 'u1', sender: 'Alice'},
    });
    game = reduce(game, {
      type: 'chat',
      timestamp: 3000,
      params: {text: 'second', senderId: 'u2', sender: 'Bob'},
    });
    expect(game.chat.messages).toHaveLength(2);
    expect(game.chat.messages[0].text).toBe('first');
    expect(game.chat.messages[1].text).toBe('second');
  });
});

describe('reduce — updateCursor', () => {
  it('adds a cursor', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCursor',
      timestamp: 2000,
      params: {cell: {r: 0, c: 1}, id: 'user1', timestamp: 2000},
    });
    expect(game.cursors).toHaveLength(1);
    expect(game.cursors[0]).toMatchObject({r: 0, c: 1, id: 'user1'});
  });

  it('replaces cursor for same user', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCursor',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, id: 'user1', timestamp: 2000},
    });
    game = reduce(game, {
      type: 'updateCursor',
      timestamp: 3000,
      params: {cell: {r: 1, c: 0}, id: 'user1', timestamp: 3000},
    });
    expect(game.cursors).toHaveLength(1);
    expect(game.cursors[0]).toMatchObject({r: 1, c: 0, id: 'user1'});
  });
});

describe('reduce — unknown action type', () => {
  it('returns game unchanged', () => {
    const game = makeGame();
    const result = reduce(game, {
      type: 'nonExistentAction',
      timestamp: 2000,
      params: {},
    });
    expect(result).toBe(game);
  });
});

describe('reduce — solved detection', () => {
  it('marks game as solved when all cells match solution', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'u1'},
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 3000,
      params: {cell: {r: 0, c: 1}, value: 'B', id: 'u1'},
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 4000,
      params: {cell: {r: 1, c: 0}, value: 'C', id: 'u1'},
    });
    expect(game.solved).toBe(true);
  });

  it('does not mark game as solved with wrong values', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'Z', id: 'u1'},
    });
    expect(game.solved).toBe(false);
  });
});
