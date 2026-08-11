import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {getGameEvents, getGameInfo} from '../../model/game';

const PUZZLE_CONTENT = {
  info: {title: 'Test Puzzle', author: 'Someone'},
  grid: [
    ['A', 'B'],
    ['C', 'D'],
  ],
  clues: {across: [], down: []},
  circles: [],
};

const SNAPSHOT = {
  grid: [
    [{value: 'A'}, {value: 'B'}],
    [{value: 'C'}, {value: 'D'}],
  ],
  users: {u1: {displayName: 'Player'}},
  clock: {lastUpdated: 0, totalTime: 500, trueTotalTime: 500, paused: true},
  chat: {messages: []},
};

/**
 * Route each query to a canned result based on the table it touches, so tests
 * don't depend on call ordering inside the model.
 */
function mockQueries({
  createPayload,
  puzzleExists = true,
  replayRetained = false,
}: {
  createPayload: object | null;
  puzzleExists?: boolean;
  replayRetained?: boolean;
}) {
  pool.query.mockImplementation(async (sql: string) => {
    if (sql.includes('game_snapshots')) {
      return {
        rows: [{gid: 'g1', pid: 'p1', snapshot: SNAPSHOT, replay_retained: replayRetained}],
        rowCount: 1,
      };
    }
    if (sql.includes('game_events')) {
      return createPayload === null
        ? {rows: [], rowCount: 0}
        : {rows: [{event_payload: createPayload}], rowCount: 1};
    }
    if (sql.includes('puzzles')) {
      return puzzleExists ? {rows: [{content: PUZZLE_CONTENT}], rowCount: 1} : {rows: [], rowCount: 0};
    }
    return {rows: [], rowCount: 0};
  });
}

describe('getGameEvents with a stripped create event', () => {
  beforeEach(resetPoolMocks);

  it('rebuilds the game from the puzzles table when params.game has been stripped', async () => {
    // What Category 4 of archive_game_events.ts leaves behind: pid, version
    // and creator survive, the puzzle copy is gone.
    mockQueries({
      createPayload: {params: {pid: 'p1', version: 1.0, creator: {userId: 'u1'}}},
    });

    const events = await getGameEvents('g1');

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('create');
    // Reconstructed from the puzzles row, not from the stored payload.
    expect(events[0].params.game.info).toEqual(PUZZLE_CONTENT.info);
    expect(events[0].params.game.solution).toEqual(PUZZLE_CONTENT.grid);
    // Snapshot state is layered on top.
    expect(events[0].params.game.grid).toEqual(SNAPSHOT.grid);
    expect(events[0].params.game.users).toEqual(SNAPSHOT.users);
    expect(events[0].params.game.clock).toEqual(SNAPSHOT.clock);
    expect(events[0].params.game.solved).toBe(true);
  });

  it('still uses the stored payload when params.game is intact', async () => {
    mockQueries({
      createPayload: {
        params: {pid: 'p1', version: 1.0, game: {info: {title: 'Stored'}, grid: [], contest: false}},
      },
    });

    const events = await getGameEvents('g1');

    expect(events).toHaveLength(1);
    expect(events[0].params.game.info.title).toBe('Stored');
    // Snapshot state is merged into the stored payload.
    expect(events[0].params.game.grid).toEqual(SNAPSHOT.grid);
    expect(events[0].params.game.solved).toBe(true);
  });

  it('does not throw when the payload is stripped and the puzzle is also gone', async () => {
    // Category 4 guards against this (it requires the puzzle to exist), but
    // the read path must degrade rather than crash if it ever happens.
    mockQueries({
      createPayload: {params: {pid: 'p1', version: 1.0}},
      puzzleExists: false,
    });

    const events = await getGameEvents('g1');

    // Falls through to loading raw events; no reconstruction is possible.
    expect(Array.isArray(events)).toBe(true);
  });
});

describe('getGameInfo with a stripped create event', () => {
  beforeEach(resetPoolMocks);

  it('falls back to the puzzles table when params.game has been stripped', async () => {
    mockQueries({createPayload: {params: {pid: 'p1', version: 1.0}}});

    const info = await getGameInfo('g1');

    expect(info).toEqual(PUZZLE_CONTENT.info);
  });

  it('reads info from the stored payload when it is intact', async () => {
    mockQueries({
      createPayload: {params: {pid: 'p1', game: {info: {title: 'Stored'}}}},
    });

    const info = await getGameInfo('g1');

    expect(info).toEqual({title: 'Stored'});
  });

  it('returns an empty object when neither payload nor puzzle is available', async () => {
    mockQueries({createPayload: {params: {pid: 'p1'}}, puzzleExists: false});

    const info = await getGameInfo('g1');

    expect(info).toEqual({});
  });
});
