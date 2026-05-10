import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

// Mock dependencies that hasReachedRatingThreshold composes with
const mockGetDfacIdsForUser = jest.fn();
jest.mock('../../model/user', () => ({
  getDfacIdsForUser: (...args: unknown[]) => mockGetDfacIdsForUser(...args),
}));

const mockComputeGamesProgress = jest.fn();
jest.mock('../../model/game_progress', () => ({
  computeGamesProgress: (...args: unknown[]) => mockComputeGamesProgress(...args),
}));

import {
  getRatingForPuzzle,
  upsertRating,
  deleteRating,
  hasReachedRatingThreshold,
  RATING_THRESHOLD_PERCENT,
} from '../../model/puzzle_rating';

beforeEach(() => {
  resetPoolMocks();
  mockGetDfacIdsForUser.mockReset();
  mockComputeGamesProgress.mockReset();
});

describe('getRatingForPuzzle', () => {
  it('returns null average and zero count when no ratings exist', async () => {
    pool.query.mockResolvedValueOnce({rows: [{avg: null, count: 0}]});
    const result = await getRatingForPuzzle('p1');
    expect(result).toEqual({average: null, count: 0, userRating: null});
  });

  it('omits the user rating query when no userId is provided', async () => {
    pool.query.mockResolvedValueOnce({rows: [{avg: 4.25, count: 4}]});
    const result = await getRatingForPuzzle('p1');
    expect(result.average).toBe(4.25);
    expect(result.count).toBe(4);
    expect(result.userRating).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns the user rating when authenticated and a rating exists', async () => {
    pool.query
      .mockResolvedValueOnce({rows: [{avg: 4.0, count: 2}]})
      .mockResolvedValueOnce({rows: [{rating: 5}]});
    const result = await getRatingForPuzzle('p1', 'user-1');
    expect(result).toEqual({average: 4.0, count: 2, userRating: 5});
  });

  it('returns null userRating when authenticated but no personal rating exists', async () => {
    pool.query.mockResolvedValueOnce({rows: [{avg: 3.5, count: 1}]}).mockResolvedValueOnce({rows: []});
    const result = await getRatingForPuzzle('p1', 'user-1');
    expect(result.userRating).toBeNull();
  });
});

describe('upsertRating', () => {
  it('issues an INSERT with ON CONFLICT for upsert semantics', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await upsertRating('p1', 'user-1', 4);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO puzzle_ratings');
    expect(sql).toContain('ON CONFLICT (pid, user_id) DO UPDATE');
    expect(pool.query.mock.calls[0][1]).toEqual(['p1', 'user-1', 4]);
  });
});

describe('deleteRating', () => {
  it('issues a DELETE keyed on (pid, user_id)', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await deleteRating('p1', 'user-1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM puzzle_ratings');
    expect(pool.query.mock.calls[0][1]).toEqual(['p1', 'user-1']);
  });
});

describe('hasReachedRatingThreshold', () => {
  it('returns true when the user has already solved the puzzle', async () => {
    pool.query.mockResolvedValueOnce({rows: [{}]});
    const eligible = await hasReachedRatingThreshold('p1', 'user-1');
    expect(eligible).toBe(true);
    // Skips the games lookup entirely
    expect(mockGetDfacIdsForUser).not.toHaveBeenCalled();
  });

  it('returns false when the user has no dfac ids and no solve', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    mockGetDfacIdsForUser.mockResolvedValueOnce([]);
    const eligible = await hasReachedRatingThreshold('p1', 'user-1');
    expect(eligible).toBe(false);
  });

  it('returns false when the user has no games and no solve', async () => {
    pool.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});
    mockGetDfacIdsForUser.mockResolvedValueOnce(['dfac-1']);
    const eligible = await hasReachedRatingThreshold('p1', 'user-1');
    expect(eligible).toBe(false);
  });

  it('returns true when any user game has reached the threshold', async () => {
    pool.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [{gid: 'g1'}, {gid: 'g2'}]});
    mockGetDfacIdsForUser.mockResolvedValueOnce(['dfac-1']);
    mockComputeGamesProgress.mockResolvedValueOnce(
      new Map([
        ['g1', 10],
        ['g2', RATING_THRESHOLD_PERCENT],
      ])
    );
    const eligible = await hasReachedRatingThreshold('p1', 'user-1');
    expect(eligible).toBe(true);
  });

  it('returns false when all user games are below threshold', async () => {
    pool.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [{gid: 'g1'}]});
    mockGetDfacIdsForUser.mockResolvedValueOnce(['dfac-1']);
    mockComputeGamesProgress.mockResolvedValueOnce(new Map([['g1', RATING_THRESHOLD_PERCENT - 1]]));
    const eligible = await hasReachedRatingThreshold('p1', 'user-1');
    expect(eligible).toBe(false);
  });

  it('does not filter dismissed games when looking up gids for eligibility', async () => {
    // Regression: getUserGamesForPuzzle excluded dismissed games, which meant a user
    // who hit 25% then dismissed the game was wrongly blocked from rating. The
    // eligibility helper must use a path that ignores game_dismissals.
    pool.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [{gid: 'g1'}]});
    mockGetDfacIdsForUser.mockResolvedValueOnce(['dfac-1']);
    mockComputeGamesProgress.mockResolvedValueOnce(new Map([['g1', RATING_THRESHOLD_PERCENT]]));
    await hasReachedRatingThreshold('p1', 'user-1');
    const gidsLookupSql = pool.query.mock.calls[1][0] as string;
    expect(gidsLookupSql).not.toContain('game_dismissals');
  });
});
