import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  getUserGamesForPuzzle,
  getAuthenticatedPuzzleStatuses,
  clearUserGamesCache,
} from '../../model/user_games';

describe('getUserGamesForPuzzle', () => {
  beforeEach(() => {
    resetPoolMocks();
    clearUserGamesCache();
  });

  it('returns empty array when no dfacIds can be resolved', async () => {
    // userId lookup returns no dfac_ids
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getUserGamesForPuzzle('123', {userId: 'user-1'});

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when neither userId nor dfacId provided', async () => {
    const result = await getUserGamesForPuzzle('123', {});

    expect(result).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns games for authenticated user', async () => {
    // dfac_id lookup
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    // main query
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          gid: 'game-1',
          pid: '123',
          solved: true,
          last_activity: new Date('2026-03-01T10:00:00Z'),
          v2: true,
        },
        {
          gid: 'game-2',
          pid: '123',
          solved: false,
          last_activity: new Date('2026-03-02T10:00:00Z'),
          v2: true,
        },
      ],
    });
    // computeGamesProgress for unsolved games
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getUserGamesForPuzzle('123', {userId: 'user-1'});

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      gid: 'game-1',
      pid: '123',
      solved: true,
      time: new Date('2026-03-01T10:00:00Z').getTime(),
      v2: true,
      percentComplete: 100,
    });
    expect(result[1]).toEqual({
      gid: 'game-2',
      pid: '123',
      solved: false,
      time: new Date('2026-03-02T10:00:00Z').getTime(),
      v2: true,
      percentComplete: 0,
    });
  });

  it('returns games for guest user with dfacId', async () => {
    // main query (no dfac_id lookup needed)
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          gid: 'game-3',
          pid: '456',
          solved: false,
          last_activity: new Date('2026-03-01T12:00:00Z'),
          v2: true,
        },
      ],
    });
    // computeGamesProgress
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getUserGamesForPuzzle('456', {dfacId: 'guest-dfac-123'});

    expect(result).toHaveLength(1);
    expect(result[0].gid).toBe('game-3');
    expect(result[0].solved).toBe(false);
    // Guest query should not include dismissal filter
    const mainQuery = pool.query.mock.calls[0][0];
    expect(mainQuery).not.toContain('game_dismissals');
  });

  it('includes dismissal filter for authenticated users', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    pool.query.mockResolvedValueOnce({rows: []});

    await getUserGamesForPuzzle('123', {userId: 'user-1'});

    // The main query should include dismissal exclusion
    const mainQuery = pool.query.mock.calls[1][0];
    expect(mainQuery).toContain('game_dismissals');
    // Should pass userId as $3 and pidInt as $4 for dismissal filter
    expect(pool.query.mock.calls[1][1]).toEqual([['dfac-abc'], '123', 'user-1', 123]);
  });

  it('deduplicates dfacId when it matches an existing one from userId lookup', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'same-dfac'}]});
    pool.query.mockResolvedValueOnce({rows: []});

    await getUserGamesForPuzzle('123', {userId: 'user-1', dfacId: 'same-dfac'});

    // The dfacIds array passed to the query should not have duplicates
    const queryArgs = pool.query.mock.calls[1][1];
    expect(queryArgs[0]).toEqual(['same-dfac']);
  });

  it('handles null last_activity', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{gid: 'game-1', pid: '123', solved: false, last_activity: null, v2: true}],
    });
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getUserGamesForPuzzle('123', {dfacId: 'guest-1'});

    expect(result[0].time).toBe(0);
  });
});

describe('getAuthenticatedPuzzleStatuses', () => {
  beforeEach(() => {
    resetPoolMocks();
    clearUserGamesCache();
  });

  it('returns empty map when user has no linked dfac_ids', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // getDfacIdsForUser
    const result = await getAuthenticatedPuzzleStatuses('user-123');
    expect(result).toEqual({});
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('marks puzzle as solved when game_snapshots entry exists', async () => {
    // getDfacIdsForUser
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    // main status query
    pool.query.mockResolvedValueOnce({
      rows: [{pid: 'puzzle-1', status: 'solved'}],
    });
    const result = await getAuthenticatedPuzzleStatuses('user-123');
    expect(result['puzzle-1']).toBe('solved');
  });

  it('marks puzzle as started when no game_snapshots entry exists', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    pool.query.mockResolvedValueOnce({
      rows: [{pid: 'puzzle-2', status: 'started'}],
    });
    const result = await getAuthenticatedPuzzleStatuses('user-123');
    expect(result['puzzle-2']).toBe('started');
  });

  it('passes all dfac_ids via ANY($1)', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{dfac_id: 'dfac-1'}, {dfac_id: 'dfac-2'}],
    });
    pool.query.mockResolvedValueOnce({rows: []});
    await getAuthenticatedPuzzleStatuses('user-123');
    const params = pool.query.mock.calls[1][1] as any[];
    expect(params[0]).toEqual(['dfac-1', 'dfac-2']);
  });

  it('uses cache on second call (no DB queries)', async () => {
    // First call: dfac_id lookup + main query
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    pool.query.mockResolvedValueOnce({rows: [{pid: 'p1', status: 'solved'}]});
    await getAuthenticatedPuzzleStatuses('user-123');

    // Second call: entire fetch is cached, no new DB queries
    const result = await getAuthenticatedPuzzleStatuses('user-123');
    expect(pool.query).toHaveBeenCalledTimes(2); // only the original 2 calls
    expect(result['p1']).toBe('solved');
  });
});
