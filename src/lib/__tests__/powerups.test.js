import powerups, {timeLeft, hasExpired, inUse, apply} from '../powerups';

describe('powerups data', () => {
  it('has REVERSE, DARK_MODE, VOWELS, REVEAL_SQUARE', () => {
    expect(powerups.REVERSE).toBeDefined();
    expect(powerups.DARK_MODE).toBeDefined();
    expect(powerups.VOWELS).toBeDefined();
    expect(powerups.REVEAL_SQUARE).toBeDefined();
  });

  it('each powerup has name, icon, duration, action', () => {
    Object.values(powerups).forEach((p) => {
      expect(typeof p.name).toBe('string');
      expect(typeof p.icon).toBe('string');
      expect(typeof p.duration).toBe('number');
      expect(typeof p.action).toBe('function');
    });
  });
});

describe('timeLeft', () => {
  it('returns full duration when not yet used', () => {
    expect(timeLeft({type: 'REVERSE', used: null})).toBe(15);
    expect(timeLeft({type: 'DARK_MODE', used: null})).toBe(30);
  });

  it('returns reduced time when used recently', () => {
    const now = Date.now();
    const result = timeLeft({type: 'DARK_MODE', used: now - 5000});
    // 30 seconds duration minus ~5 seconds elapsed
    expect(result).toBeGreaterThan(20);
    expect(result).toBeLessThanOrEqual(26);
  });

  it('returns negative when expired', () => {
    const longAgo = Date.now() - 60000;
    expect(timeLeft({type: 'REVERSE', used: longAgo})).toBeLessThan(0);
  });
});

describe('hasExpired', () => {
  it('returns false for unused powerup', () => {
    expect(hasExpired({type: 'REVERSE', used: null})).toBe(false);
  });

  it('returns true for long-ago used powerup', () => {
    expect(hasExpired({type: 'REVERSE', used: Date.now() - 60000})).toBe(true);
  });

  it('returns false for recently used powerup', () => {
    expect(hasExpired({type: 'DARK_MODE', used: Date.now()})).toBe(false);
  });
});

describe('inUse', () => {
  it('returns falsy when not used', () => {
    expect(inUse({type: 'REVERSE', used: null})).toBeFalsy();
    expect(inUse({type: 'REVERSE', used: undefined})).toBeFalsy();
  });

  it('returns true when used and not expired', () => {
    expect(inUse({type: 'DARK_MODE', used: Date.now()})).toBe(true);
  });

  it('returns false when used and expired', () => {
    expect(inUse({type: 'REVERSE', used: Date.now() - 60000})).toBe(false);
  });
});

describe('powerup actions', () => {
  const makeGame = () => ({
    clues: {
      across: ['First clue', 'Second clue'],
      down: ['Down one', 'Down two'],
    },
    grid: [
      [
        {value: 'A', black: false},
        {value: 'B', black: false},
      ],
      [
        {value: 'C', black: false},
        {value: '', black: true},
      ],
    ],
    cursors: [{r: 0, c: 0}],
  });

  it('REVERSE reverses opponent clue text', () => {
    const game = makeGame();
    const {opponentGame} = powerups.REVERSE.action({ownGame: game, opponentGame: game});
    expect(opponentGame.clues.across[0]).toBe('eulc tsriF');
  });

  it('VOWELS removes vowels from opponent clues', () => {
    const game = makeGame();
    const {opponentGame} = powerups.VOWELS.action({ownGame: game, opponentGame: game});
    expect(opponentGame.clues.across[0]).toBe('Frst cl');
  });

  it('DARK_MODE hides squares far from cursor', () => {
    const game = makeGame();
    // With cursor at (0,0) and a 2x2 grid, all cells are within range 3
    const {opponentGame} = powerups.DARK_MODE.action({ownGame: game, opponentGame: game});
    // All within range — values should be preserved
    expect(opponentGame.grid[0][0].value).toBe('A');
  });
});

describe('apply', () => {
  it('returns games unchanged when no powerups active', () => {
    const game1 = {clues: {across: ['a'], down: ['b']}, grid: [], cursors: []};
    const game2 = {clues: {across: ['c'], down: ['d']}, grid: [], cursors: []};
    const {ownGame, opponentGame} = apply(game1, game2, [], []);
    expect(ownGame).toEqual(game1);
    expect(opponentGame).toEqual(game2);
  });

  it('returns both games as-is when either is null', () => {
    const {ownGame, opponentGame} = apply(null, null, [], []);
    expect(ownGame).toBeNull();
    expect(opponentGame).toBeNull();
  });
});
