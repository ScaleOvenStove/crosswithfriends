import {pool, resetPoolMocks, mockClient} from '../../__mocks__/pool';

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
    pool.query.mockResolvedValueOnce({rows: [{rating_avg: null, rating_count: 0}]});
    const result = await getRatingForPuzzle('p1');
    expect(result).toEqual({average: null, count: 0, userRating: null});
  });

  it('reads aggregate from denormalized columns on puzzles, not puzzle_ratings', async () => {
    pool.query.mockResolvedValueOnce({rows: [{rating_avg: 4.25, rating_count: 4}]});
    await getRatingForPuzzle('p1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('FROM puzzles');
    expect(sql).toContain('rating_avg');
    expect(sql).toContain('rating_count');
    expect(sql).not.toContain('AVG(rating)');
  });

  it('omits the user rating query when no userId is provided', async () => {
    pool.query.mockResolvedValueOnce({rows: [{rating_avg: 4.25, rating_count: 4}]});
    const result = await getRatingForPuzzle('p1');
    expect(result.average).toBe(4.25);
    expect(result.count).toBe(4);
    expect(result.userRating).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns the user rating when authenticated and a rating exists', async () => {
    pool.query
      .mockResolvedValueOnce({rows: [{rating_avg: 4.0, rating_count: 2}]})
      .mockResolvedValueOnce({rows: [{rating: 5}]});
    const result = await getRatingForPuzzle('p1', 'user-1');
    expect(result).toEqual({average: 4.0, count: 2, userRating: 5});
  });

  it('returns null userRating when authenticated but no personal rating exists', async () => {
    pool.query
      .mockResolvedValueOnce({rows: [{rating_avg: 3.5, rating_count: 1}]})
      .mockResolvedValueOnce({rows: []});
    const result = await getRatingForPuzzle('p1', 'user-1');
    expect(result.userRating).toBeNull();
  });
});

describe('upsertRating', () => {
  it('runs the write + denormalized refresh inside a transaction', async () => {
    mockClient.query
      .mockResolvedValueOnce({rows: []}) // BEGIN
      .mockResolvedValueOnce({rows: []}) // SELECT 1 ... FOR UPDATE
      .mockResolvedValueOnce({rows: []}) // INSERT INTO puzzle_ratings
      .mockResolvedValueOnce({rows: []}) // refreshPuzzleRatingStats
      .mockResolvedValueOnce({rows: []}); // COMMIT

    await upsertRating('p1', 'user-1', 4);

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    expect(allSql[0]).toBe('BEGIN');
    expect(allSql.some((s) => s.includes('FOR UPDATE'))).toBe(true);
    const insertCall = mockClient.query.mock.calls.find((c: any[]) =>
      (c[0] as string).includes('INSERT INTO puzzle_ratings')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('ON CONFLICT (pid, user_id) DO UPDATE');
    expect(insertCall![1]).toEqual(['p1', 'user-1', 4]);
    // Stats refresh writes rating_avg/count/weighted back to puzzles.
    expect(allSql.some((s) => s.includes('UPDATE puzzles') && s.includes('rating_avg'))).toBe(true);
    expect(allSql[allSql.length - 1]).toBe('COMMIT');
  });

  it('rolls back and releases the client on error', async () => {
    mockClient.query
      .mockResolvedValueOnce({rows: []}) // BEGIN
      .mockRejectedValueOnce(new Error('lock fail')); // SELECT FOR UPDATE blows up
    mockClient.query.mockResolvedValueOnce({rows: []}); // ROLLBACK

    await expect(upsertRating('p1', 'user-1', 4)).rejects.toThrow('lock fail');

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    expect(allSql).toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('deleteRating', () => {
  it('runs the delete + denormalized refresh inside a transaction', async () => {
    mockClient.query
      .mockResolvedValueOnce({rows: []}) // BEGIN
      .mockResolvedValueOnce({rows: []}) // SELECT 1 ... FOR UPDATE
      .mockResolvedValueOnce({rows: []}) // DELETE
      .mockResolvedValueOnce({rows: []}) // refresh
      .mockResolvedValueOnce({rows: []}); // COMMIT

    await deleteRating('p1', 'user-1');

    const allSql = mockClient.query.mock.calls.map((c: any[]) => c[0] as string);
    const deleteCall = mockClient.query.mock.calls.find((c: any[]) =>
      (c[0] as string).includes('DELETE FROM puzzle_ratings')
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toEqual(['p1', 'user-1']);
    expect(allSql.some((s) => s.includes('UPDATE puzzles') && s.includes('rating_avg'))).toBe(true);
    expect(allSql[allSql.length - 1]).toBe('COMMIT');
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
