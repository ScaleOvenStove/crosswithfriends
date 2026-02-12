import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {addGameEvent, GameEvent} from '../../model/game';

describe('addGameEvent', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('extracts uid from event.params.id when event.user is null', async () => {
    const event: GameEvent = {
      user: undefined,
      timestamp: 1700000000000,
      type: 'updateCell',
      params: {id: 'dfac-abc-123', cell: {r: 0, c: 0}, value: 'A'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('game-1'); // gid
    expect(params[1]).toBe('dfac-abc-123'); // uid extracted from params.id
  });

  it('uses event.user when it is provided', async () => {
    const event: GameEvent = {
      user: 'actual-user',
      timestamp: 1700000000000,
      type: 'updateCell',
      params: {id: 'dfac-abc-123'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[1]).toBe('actual-user');
  });

  it('sets uid to null when neither user nor params.id is available', async () => {
    const event: GameEvent = {
      timestamp: 1700000000000,
      type: 'updateCursor',
      params: {},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[1]).toBeNull();
  });

  it('stores the correct gid', async () => {
    const event: GameEvent = {
      timestamp: 1700000000000,
      type: 'updateCell',
      params: {id: 'player-1'},
    };

    await addGameEvent('my-game-id', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('my-game-id');
  });

  it('converts timestamp to ISO string for ts column', async () => {
    const timestamp = 1700000000000; // 2023-11-14T22:13:20.000Z
    const event: GameEvent = {
      timestamp,
      type: 'updateCell',
      params: {id: 'player-1'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[2]).toBe(new Date(timestamp).toISOString());
  });

  it('stores the event type', async () => {
    const event: GameEvent = {
      timestamp: 1700000000000,
      type: 'check',
      params: {id: 'player-1'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[3]).toBe('check');
  });

  it('stores the full event object as payload', async () => {
    const event: GameEvent = {
      timestamp: 1700000000000,
      type: 'updateCell',
      params: {id: 'player-1', cell: {r: 2, c: 3}, value: 'X'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[4]).toBe(event);
  });

  it('inserts into game_events table with correct columns', async () => {
    const event: GameEvent = {
      timestamp: 1700000000000,
      type: 'updateCell',
      params: {id: 'player-1'},
    };

    await addGameEvent('game-1', event);

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO game_events');
    expect(sql).toContain('gid');
    expect(sql).toContain('uid');
    expect(sql).toContain('ts');
    expect(sql).toContain('event_type');
    expect(sql).toContain('event_payload');
  });

  it('prefers event.user over params.id (falsy check)', async () => {
    // event.user is empty string — falsy, so should fall back to params.id
    const event: GameEvent = {
      user: '',
      timestamp: 1700000000000,
      type: 'create',
      params: {id: 'dfac-fallback'},
    };

    await addGameEvent('game-1', event);

    const params = pool.query.mock.calls[0][1] as any[];
    // Empty string is falsy, so it should fall through to params.id
    expect(params[1]).toBe('dfac-fallback');
  });
});
