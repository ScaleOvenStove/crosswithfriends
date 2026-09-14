import express from 'express';
import request from 'supertest';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

const mockCaptureException = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  logger: {warn: (...args: unknown[]) => mockLoggerWarn(...args)},
}));

const mockGetUserById = jest.fn();
const mockGetUserSolveStats = jest.fn();
const mockGetInProgressGames = jest.fn();
const mockGetSolvedPidsForUser = jest.fn();
const mockGetUserUploadedPuzzles = jest.fn();
const mockGetAuthenticatedPuzzleStatuses = jest.fn();
const mockVerifyAccessToken = jest.fn();

jest.mock('../../model/user', () => ({getUserById: (...a: unknown[]) => mockGetUserById(...a)}));
jest.mock('../../model/puzzle_solve', () => ({
  getUserSolveStats: (...a: unknown[]) => mockGetUserSolveStats(...a),
  getInProgressGames: (...a: unknown[]) => mockGetInProgressGames(...a),
  getSolvedPidsForUser: (...a: unknown[]) => mockGetSolvedPidsForUser(...a),
}));
jest.mock('../../model/puzzle', () => ({
  getUserUploadedPuzzles: (...a: unknown[]) => mockGetUserUploadedPuzzles(...a),
}));
jest.mock('../../model/user_games', () => ({
  getAuthenticatedPuzzleStatuses: (...a: unknown[]) => mockGetAuthenticatedPuzzleStatuses(...a),
}));
jest.mock('../../auth/jwt', () => ({verifyAccessToken: (...a: unknown[]) => mockVerifyAccessToken(...a)}));

const USER_ID = 'user-123';

/** A Postgres statement_timeout, as pg surfaces it (SQLSTATE 57014). */
function statementTimeout() {
  return Object.assign(new Error('canceling statement due to statement timeout'), {code: '57014'});
}

/** What pg-pool throws when no connection frees up within connectionTimeoutMillis. */
function poolAcquireTimeout() {
  return new Error('timeout exceeded when trying to connect');
}

const EMPTY_STATS = {
  totalSolved: 0,
  totalSolvedSolo: 0,
  totalSolvedCoop: 0,
  bySize: [],
  byDay: [],
  bySizeSolo: [],
  bySizeCoop: [],
  byDaySolo: [],
  byDayCoop: [],
  history: [],
};

function buildApp() {
  const router = require('../../api/user_stats').default;
  const app = express();
  app.use('/user-stats', router);
  return app;
}

/** Request the profile as its owner, so the owner-only sections run. */
function getOwnProfile() {
  return request(buildApp()).get(`/user-stats/${USER_ID}`).set('Authorization', 'Bearer token');
}

describe('GET /user-stats/:userId — degraded reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserById.mockResolvedValue({
      display_name: 'Someone',
      created_at: new Date('2026-01-01T00:00:00Z'),
      profile_is_public: true,
    });
    mockVerifyAccessToken.mockReturnValue({userId: USER_ID});
    mockGetUserSolveStats.mockResolvedValue(EMPTY_STATS);
    mockGetInProgressGames.mockResolvedValue([]);
    mockGetSolvedPidsForUser.mockResolvedValue([]);
    mockGetUserUploadedPuzzles.mockResolvedValue([]);
    mockGetAuthenticatedPuzzleStatuses.mockResolvedValue({});
  });

  // NODE-EXPRESS-N: this path already degrades to an empty list, so a slow
  // query was opening a Sentry Issue for a request the user still got an
  // answer to. It belongs in logs, not in the Issue stream.
  it('logs rather than captures when getInProgressGames trips statement_timeout', async () => {
    mockGetInProgressGames.mockRejectedValue(statementTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.inProgress).toBeUndefined();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('degraded'),
      expect.objectContaining({section: 'getInProgressGames', userId: USER_ID})
    );
  });

  // readPool is deliberately small, so "no connection available" is normal
  // back-pressure, not an edge case. It carries no SQLSTATE, so it has to be
  // recognised separately from a statement timeout — otherwise capping the
  // pool just converts NODE-EXPRESS-H into 500s on this endpoint.
  it('degrades when the read pool has no connection to give', async () => {
    mockGetInProgressGames.mockRejectedValue(poolAcquireTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.inProgress).toBeUndefined();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({section: 'getInProgressGames'})
    );
  });

  it('degrades the stats block on a pool acquire timeout too', async () => {
    mockGetUserSolveStats.mockRejectedValue(poolAcquireTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.stats.totalSolved).toBe(0);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  // Cache-Control alone doesn't stop NewPuzzleList persisting the derived
  // status map to localStorage, so the flag has to reach the client too.
  it.each([
    ['getInProgressGames', () => mockGetInProgressGames],
    ['getAuthenticatedPuzzleStatuses', () => mockGetAuthenticatedPuzzleStatuses],
    ['getSolvedPidsForUser', () => mockGetSolvedPidsForUser],
    ['getUserUploadedPuzzles', () => mockGetUserUploadedPuzzles],
  ])('marks the whole response degraded when %s times out', async (_section, getMock) => {
    getMock().mockRejectedValue(statementTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  // The client rebuilds its puzzle-status map from these three and caches it,
  // so a field it couldn't read must be absent rather than empty — empty reads
  // as "you have none" and overwrites the cache.
  it.each([
    ['inProgress', () => mockGetInProgressGames],
    ['snapshotStatuses', () => mockGetAuthenticatedPuzzleStatuses],
    ['solvedPids', () => mockGetSolvedPidsForUser],
  ])('omits %s entirely when its read fails', async (field, getMock) => {
    getMock().mockRejectedValue(statementTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body[field]).toBeUndefined();
  });

  // The counterpart: an unrelated section failing must NOT strip the status
  // inputs, or the client throws away a perfectly good map and keeps a stale
  // one for the rest of the session.
  it.each([
    ['getUserSolveStats', () => mockGetUserSolveStats],
    ['getUserUploadedPuzzles', () => mockGetUserUploadedPuzzles],
  ])('still sends the status inputs when only %s fails', async (_section, getMock) => {
    mockGetInProgressGames.mockResolvedValue([{pid: '1', gid: 'g1'}]);
    mockGetAuthenticatedPuzzleStatuses.mockResolvedValue({'2': 'started'});
    mockGetSolvedPidsForUser.mockResolvedValue(['3']);
    getMock().mockRejectedValue(statementTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.inProgress).toEqual([{pid: '1', gid: 'g1'}]);
    expect(res.body.snapshotStatuses).toEqual({'2': 'started'});
    expect(res.body.solvedPids).toEqual(['3']);
  });

  it('leaves the response uncached-as-complete only when something actually failed', async () => {
    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.headers['cache-control']).toBe('private, max-age=30');
  });

  it('does not mark the response degraded for a non-transient section failure', async () => {
    // A real bug in one optional section isn't DB saturation: the rest of the
    // profile is complete and still worth caching.
    mockGetInProgressGames.mockRejectedValue(new Error('column does not exist'));

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.headers['cache-control']).toBe('private, max-age=30');
  });

  it('still captures a non-timeout failure as an exception', async () => {
    mockGetInProgressGames.mockRejectedValue(new Error('column does not exist'));

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({extra: {section: 'getInProgressGames', userId: USER_ID}})
    );
  });

  it('degrades the whole stats block on statement_timeout without caching it', async () => {
    mockGetUserSolveStats.mockRejectedValue(statementTimeout());

    const res = await getOwnProfile();

    expect(res.status).toBe(200);
    expect(res.body.stats.totalSolved).toBe(0);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({section: 'getUserSolveStats'})
    );
  });

  it('propagates a non-timeout stats failure to the error handler', async () => {
    mockGetUserSolveStats.mockRejectedValue(new Error('boom'));

    const res = await getOwnProfile();

    expect(res.status).toBe(500);
  });
});
