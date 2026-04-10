import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  getInProgressGames,
  getUserSolveStats,
  backfillSolvesForDfacId,
  clearInProgressGamesCache,
} from '../../model/puzzle_solve';

describe('getInProgressGames', () => {
  beforeEach(() => {
    resetPoolMocks();
    clearInProgressGamesCache();
  });

  it('returns empty array when user has no linked dfac_ids', async () => {
    pool.query.mockResolvedValueOnce({rows: []});

    const result = await getInProgressGames('user-123');

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT dfac_id FROM user_identity_map WHERE user_id = $1', [
      'user-123',
    ]);
  });

  it('returns in-progress games when user has linked dfac_ids', async () => {
    // First call: user_identity_map lookup
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    // Second call: main in-progress query
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          gid: 'game-1',
          pid: 'puzzle-1',
          title: 'Sunday Crossword',
          size: '15x15',
          last_activity: new Date('2026-02-22T12:00:00Z'),
        },
      ],
    });
    const result = await getInProgressGames('user-123');

    expect(result).toEqual([
      {
        gid: 'game-1',
        pid: 'puzzle-1',
        title: 'Sunday Crossword',
        size: '15x15',
        lastActivity: '2026-02-22T12:00:00.000Z',
        percentComplete: 0,
      },
    ]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('uses "Untitled" when title is null', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-abc'}]});
    pool.query.mockResolvedValueOnce({
      rows: [{gid: 'game-1', pid: 'puzzle-1', title: null, size: '15x15', last_activity: null}],
    });

    const result = await getInProgressGames('user-123');

    expect(result[0].title).toBe('Untitled');
    expect(result[0].lastActivity).toBe('');
    expect(result[0].percentComplete).toBe(0);
  });
});

describe('getUserSolveStats', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns {totalSolved, bySize, byDay, history} structure', async () => {
    // Combined stats+day CTE query (size rows then day rows via UNION ALL)
    pool.query.mockResolvedValueOnce({
      rows: [
        {stat_type: 'size', key: '15x15', count: 5, avg_time: 300},
        {stat_type: 'day', key: 'Mon', count: 3, avg_time: 120},
      ],
    });
    // History query
    pool.query.mockResolvedValueOnce({
      rows: [],
    });

    const result = await getUserSolveStats('user-1');
    expect(result).toHaveProperty('totalSolved');
    expect(result).toHaveProperty('bySize');
    expect(result).toHaveProperty('byDay');
    expect(result).toHaveProperty('history');
    expect(result.byDay).toEqual([{day: 'Mon', count: 3, avgTime: 120}]);
  });

  it('sums count across sizes for totalSolved', async () => {
    // Combined stats CTE returns both size rows
    pool.query.mockResolvedValueOnce({
      rows: [
        {stat_type: 'size', key: '5x5', count: 3, avg_time: 60},
        {stat_type: 'size', key: '15x15', count: 7, avg_time: 300},
      ],
    });
    pool.query.mockResolvedValueOnce({rows: []}); // history

    const result = await getUserSolveStats('user-1');
    expect(result.totalSolved).toBe(10);
    expect(result.bySize).toHaveLength(2);
  });

  it('defaults title to "Untitled" and playerCount to 1', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // combined stats
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          pid: 'p1',
          gid: 'g1',
          time_taken_to_solve: 200,
          solved_time: new Date('2026-01-15'),
          player_count: null,
          title: null,
          size: '5x5',
          dow: null,
        },
      ],
    }); // history

    const result = await getUserSolveStats('user-1');
    expect(result.history[0].title).toBe('Untitled');
    expect(result.history[0].playerCount).toBe(1);
    expect(result.history[0].dow).toBeNull();
  });

  it('includes dow field in history items', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // combined stats
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          pid: 'p1',
          gid: 'g1',
          time_taken_to_solve: 200,
          solved_time: new Date('2026-01-15'),
          player_count: 1,
          title: 'Monday Puzzle',
          size: '5x5',
          dow: 'Mon',
        },
      ],
    }); // history

    const result = await getUserSolveStats('user-1');
    expect(result.history[0].dow).toBe('Mon');
  });

  it('fetches co-solvers for collaborative games (player_count > 1)', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // combined stats
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          pid: 'p1',
          gid: 'g-collab',
          time_taken_to_solve: 200,
          solved_time: new Date('2026-01-15'),
          player_count: 3,
          title: 'Collab Puzzle',
          size: '15x15',
          dow: null,
        },
      ],
    }); // history
    // Combined co-solver + count query (uses window function)
    pool.query.mockResolvedValueOnce({
      rows: [
        {gid: 'g-collab', user_id: 'friend-1', display_name: 'Friend', solver_count: 2},
        {gid: 'g-collab', user_id: 'user-1', display_name: 'Me', solver_count: 2},
      ],
    });

    const result = await getUserSolveStats('user-1');
    expect(result.history[0].coSolvers).toHaveLength(1);
    expect(result.history[0].coSolvers[0].displayName).toBe('Friend');
    expect(result.history[0].anonCount).toBe(1); // 3 players - 2 authenticated = 1 anon
  });
});

describe('backfillSolvesForDfacId', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns rowCount from INSERT...ON CONFLICT DO NOTHING', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 3});
    const result = await backfillSolvesForDfacId('user-1', 'dfac-abc');
    expect(result).toBe(3);
  });

  it('passes userId and dfacId to the query', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 0});
    await backfillSolvesForDfacId('user-1', 'dfac-xyz');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('user-1');
    expect(params[1]).toBe('dfac-xyz');
  });

  it('uses ON CONFLICT DO NOTHING so repeated calls are safe', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 0});
    await backfillSolvesForDfacId('user-1', 'dfac-abc');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT DO NOTHING');
  });
});
