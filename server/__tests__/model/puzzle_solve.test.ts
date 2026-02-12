import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {getInProgressGames} from '../../model/puzzle_solve';

describe('getInProgressGames', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('queries using the user ID parameter', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('user-123');
  });

  it('checks both uid column and event_payload params.id for dfac_id matching', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    // Should check uid column
    expect(sql).toContain('ge.uid IN (SELECT dfac_id FROM user_dfac_ids)');
    // Should also check event_payload for backward compat with null uid
    expect(sql).toContain("ge.event_payload->'params'->>'id' IN (SELECT dfac_id FROM user_dfac_ids)");
  });

  it('uses user_identity_map to resolve dfac_ids', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('user_identity_map');
    expect(sql).toContain('user_id = $1');
  });

  it('excludes games that have been solved', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('solved_games');
    expect(sql).toContain('puzzle_solves');
    expect(sql).toContain('NOT IN (SELECT gid FROM solved_games)');
  });

  it('joins game_events for create event to get pid', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("event_type = 'create'");
    expect(sql).toContain("event_payload->'params'->>'pid'");
  });

  it('orders by last_activity DESC and limits to 50', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY last_activity DESC');
    expect(sql).toContain('LIMIT 50');
  });

  it('maps results correctly with all fields', async () => {
    const now = new Date('2024-06-15T10:30:00Z');
    pool.query.mockResolvedValue({
      rows: [
        {
          gid: 'game-1',
          pid: 'puzzle-1',
          title: 'Monday Mini',
          size: '5x5',
          last_activity: now,
        },
      ],
    });

    const result = await getInProgressGames('user-123');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      gid: 'game-1',
      pid: 'puzzle-1',
      title: 'Monday Mini',
      size: '5x5',
      lastActivity: '2024-06-15T10:30:00.000Z',
    });
  });

  it('defaults pid to empty string when null', async () => {
    pool.query.mockResolvedValue({
      rows: [{gid: 'game-1', pid: null, title: 'Test', size: '5x5', last_activity: new Date()}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].pid).toBe('');
  });

  it('defaults title to Untitled when null', async () => {
    pool.query.mockResolvedValue({
      rows: [{gid: 'game-1', pid: 'p1', title: null, size: '5x5', last_activity: new Date()}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].title).toBe('Untitled');
  });

  it('defaults size to empty string when null', async () => {
    pool.query.mockResolvedValue({
      rows: [{gid: 'game-1', pid: 'p1', title: 'Test', size: null, last_activity: new Date()}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].size).toBe('');
  });

  it('defaults lastActivity to empty string when null', async () => {
    pool.query.mockResolvedValue({
      rows: [{gid: 'game-1', pid: 'p1', title: 'Test', size: '5x5', last_activity: null}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].lastActivity).toBe('');
  });

  it('returns empty array when no in-progress games found', async () => {
    pool.query.mockResolvedValue({rows: []});

    const result = await getInProgressGames('user-123');

    expect(result).toEqual([]);
  });

  it('also checks event_payload params.id in last_activity subquery', async () => {
    pool.query.mockResolvedValue({rows: []});

    await getInProgressGames('user-123');

    const sql = pool.query.mock.calls[0][0] as string;
    // The last_activity subquery should also have the OR clause for backward compat
    const lastActivityPart = sql.substring(sql.indexOf('SELECT MAX(ge2.ts)'));
    expect(lastActivityPart).toContain('ge2.uid IN (SELECT dfac_id FROM user_dfac_ids)');
    expect(lastActivityPart).toContain(
      "ge2.event_payload->'params'->>'id' IN (SELECT dfac_id FROM user_dfac_ids)"
    );
  });
});
