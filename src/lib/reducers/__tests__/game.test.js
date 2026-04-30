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

  // Regression: previously an out-of-bounds (r, c) threw inside the reducer,
  // which `reduce` caught and returned the stale `result`. From the user's
  // perspective the typed letter would silently disappear (#482).
  it('returns game unchanged when r is out of range', () => {
    const game = makeGame();
    const result = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 99, c: 0}, value: 'X', id: 'user1'},
    });
    expect(result.grid).toBe(game.grid);
  });

  it('returns game unchanged when c is out of range', () => {
    const game = makeGame();
    const result = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 99}, value: 'X', id: 'user1'},
    });
    expect(result.grid).toBe(game.grid);
  });

  it('does not throw when grid is undefined', () => {
    // Defends against a reducer call landing on a malformed game state — e.g.
    // an updateCell arriving before the create event has hydrated.
    const partialGame = {pid: 'x', solution: [['']]};
    expect(() =>
      reduce(partialGame, {
        type: 'updateCell',
        timestamp: 2000,
        params: {cell: {r: 0, c: 0}, value: 'X', id: 'user1'},
      })
    ).not.toThrow();
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

  it('does not auto-solve when all solutions are empty', () => {
    let game = makeGame({
      solution: [
        ['', ''],
        ['', '.'],
      ],
    });
    // Fill in values — should not trigger solved since solution is all empty
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'X', id: 'u1'},
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 3000,
      params: {cell: {r: 0, c: 1}, value: 'X', id: 'u1'},
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 4000,
      params: {cell: {r: 1, c: 0}, value: 'X', id: 'u1'},
    });
    expect(game.solved).toBe(false);
  });
});

describe('reduce — solved detection with image cells', () => {
  it('solves when image cells have empty solution and empty value', () => {
    // 2x2 grid: (0,0)=A, (0,1)=image cell, (1,0)=B, (1,1)=black
    let game = makeGame({
      grid: [
        [
          {value: '', black: false},
          {value: '', black: false, isImage: true},
        ],
        [
          {value: '', black: false},
          {value: '', black: true},
        ],
      ],
      solution: [
        ['A', ''],
        ['B', '.'],
      ],
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'u1'},
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 3000,
      params: {cell: {r: 1, c: 0}, value: 'B', id: 'u1'},
    });
    expect(game.solved).toBe(true);
  });

  it('does not solve when only image cells match but real cells do not', () => {
    let game = makeGame({
      grid: [
        [
          {value: '', black: false},
          {value: '', black: false, isImage: true},
        ],
        [
          {value: '', black: false},
          {value: '', black: true},
        ],
      ],
      solution: [
        ['A', ''],
        ['B', '.'],
      ],
    });
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'Z', id: 'u1'},
    });
    expect(game.solved).toBe(false);
  });
});

describe('reduce — check/reveal/reset with out-of-bounds scope', () => {
  it('check ignores scope coordinates beyond grid dimensions', () => {
    let game = makeGame(); // 2x2 grid
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'u1'},
    });
    // Scope includes an out-of-bounds row (r=5 on a 2-row grid)
    game = reduce(game, {
      type: 'check',
      timestamp: 3000,
      params: {
        scope: [
          {r: 0, c: 0},
          {r: 5, c: 0},
        ],
      },
    });
    // The in-bounds cell should still be checked correctly
    expect(game.grid[0][0].good).toBe(true);
  });

  it('check ignores scope coordinates with out-of-bounds column', () => {
    let game = makeGame(); // 2x2 grid
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'u1'},
    });
    game = reduce(game, {
      type: 'check',
      timestamp: 3000,
      params: {
        scope: [
          {r: 0, c: 0},
          {r: 0, c: 10},
        ],
      },
    });
    expect(game.grid[0][0].good).toBe(true);
  });

  it('reveal ignores out-of-bounds scope coordinates', () => {
    let game = makeGame(); // 2x2 grid
    game = reduce(game, {
      type: 'reveal',
      timestamp: 2000,
      params: {
        scope: [
          {r: 0, c: 0},
          {r: 99, c: 99},
        ],
      },
    });
    expect(game.grid[0][0].value).toBe('A');
    expect(game.grid[0][0].good).toBe(true);
  });

  it('reset ignores out-of-bounds scope coordinates', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'A', id: 'u1'},
    });
    game = reduce(game, {
      type: 'reset',
      timestamp: 3000,
      params: {
        scope: [
          {r: 0, c: 0},
          {r: 5, c: 0},
        ],
      },
    });
    expect(game.grid[0][0].value).toBe('');
  });

  it('check with entirely out-of-bounds scope does not crash', () => {
    let game = makeGame();
    // All scope coordinates are out of bounds
    game = reduce(game, {
      type: 'check',
      timestamp: 2000,
      params: {
        scope: [
          {r: 10, c: 10},
          {r: -1, c: 0},
        ],
      },
    });
    // Game should be returned unchanged (no crash)
    expect(game.grid[0][0].good).toBeFalsy();
  });
});

describe('reduce — contest puzzles', () => {
  function makeContestGame() {
    return makeGame({
      contest: true,
      solution: [
        ['', ''],
        ['', '.'],
      ],
    });
  }

  it('creates game with contest flag and contestSolved', () => {
    const game = makeContestGame();
    expect(game.contest).toBe(true);
    expect(game.contestSolved).toBe(false);
    expect(game.solved).toBe(false);
  });

  it('check is a no-op for contest puzzles', () => {
    let game = makeContestGame();
    game = reduce(game, {
      type: 'updateCell',
      timestamp: 2000,
      params: {cell: {r: 0, c: 0}, value: 'X', id: 'u1'},
    });
    const beforeCheck = {...game.grid[0][0]};
    game = reduce(game, {
      type: 'check',
      timestamp: 3000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].good).toBe(beforeCheck.good);
    expect(game.grid[0][0].bad).toBe(beforeCheck.bad);
  });

  it('reveal is a no-op for contest puzzles', () => {
    let game = makeContestGame();
    game = reduce(game, {
      type: 'reveal',
      timestamp: 2000,
      params: {scope: [{r: 0, c: 0}]},
    });
    expect(game.grid[0][0].revealed).toBeFalsy();
    expect(game.grid[0][0].good).toBeFalsy();
  });

  it('markSolved sets contestSolved and solved', () => {
    let game = makeContestGame();
    game = reduce(game, {
      type: 'markSolved',
      timestamp: 2000,
      params: {},
    });
    expect(game.contestSolved).toBe(true);
    expect(game.solved).toBe(true);
  });

  it('unmarkSolved clears contestSolved and solved', () => {
    let game = makeContestGame();
    game = reduce(game, {
      type: 'markSolved',
      timestamp: 2000,
      params: {},
    });
    expect(game.solved).toBe(true);
    game = reduce(game, {
      type: 'unmarkSolved',
      timestamp: 3000,
      params: {},
    });
    expect(game.contestSolved).toBe(false);
    expect(game.solved).toBe(false);
  });

  it('markSolved is a no-op for non-contest puzzles', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'markSolved',
      timestamp: 2000,
      params: {},
    });
    expect(game.contestSolved).toBe(false);
    expect(game.solved).toBe(false);
  });

  it('unmarkSolved is a no-op for non-contest puzzles', () => {
    let game = makeGame();
    game = reduce(game, {
      type: 'unmarkSolved',
      timestamp: 2000,
      params: {},
    });
    expect(game.contestSolved).toBe(false);
  });
});
