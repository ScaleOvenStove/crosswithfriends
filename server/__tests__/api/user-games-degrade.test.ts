import express from 'express';
import request from 'supertest';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

const mockCaptureException = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  logger: {warn: (...args: unknown[]) => mockLoggerWarn(...args)},
}));

const mockGetUserGamesForPuzzle = jest.fn();
const mockGetGuestPuzzleStatuses = jest.fn();
jest.mock('../../model/user_games', () => ({
  getUserGamesForPuzzle: (...a: unknown[]) => mockGetUserGamesForPuzzle(...a),
  getGuestPuzzleStatuses: (...a: unknown[]) => mockGetGuestPuzzleStatuses(...a),
}));
jest.mock('../../auth/middleware', () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function statementTimeout() {
  return Object.assign(new Error('canceling statement due to statement timeout'), {code: '57014'});
}

/** What pg-pool throws when no connection frees up within connectionTimeoutMillis. */
function poolAcquireTimeout() {
  return new Error('timeout exceeded when trying to connect');
}

function buildApp() {
  const router = require('../../api/user_games').default;
  const app = express();
  app.use('/user-games', router);
  return app;
}

describe('GET /user-games — degraded reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserGamesForPuzzle.mockResolvedValue([]);
  });

  it.each([
    ['statement timeout', statementTimeout],
    ['pool acquire timeout', poolAcquireTimeout],
  ])('flags the result degraded on a %s', async (_label, makeError) => {
    mockGetUserGamesForPuzzle.mockRejectedValue(makeError());

    const res = await request(buildApp()).get('/user-games?pid=123&dfac_id=abc');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({games: [], degraded: true});
    expect(res.headers['cache-control']).toBe('no-store');
  });

  // Back-pressure from the small readPool is an intended operating condition,
  // so it belongs in logs — capturing it reintroduces exactly the Sentry Issue
  // noise this change set removes from the user-stats route.
  it('logs pool-acquire back-pressure rather than capturing it', async () => {
    mockGetUserGamesForPuzzle.mockRejectedValue(poolAcquireTimeout());

    await request(buildApp()).get('/user-games?pid=123&dfac_id=abc');

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({section: 'getUserGamesForPuzzle'})
    );
  });

  it('propagates a non-transient failure to the error handler', async () => {
    mockGetUserGamesForPuzzle.mockRejectedValue(new Error('boom'));

    const res = await request(buildApp()).get('/user-games?pid=123&dfac_id=abc');

    // Delegated to the error middleware via next(e) — not swallowed as a
    // degraded 200, and not reported here (server.ts owns that).
    expect(res.status).toBe(500);
    expect(res.body.degraded).toBeUndefined();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

describe('GET /user-games/statuses — degraded reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGuestPuzzleStatuses.mockResolvedValue({});
  });

  it('returns the real statuses when the read succeeds', async () => {
    mockGetGuestPuzzleStatuses.mockResolvedValue({'123': 'solved'});

    const res = await request(buildApp()).get('/user-games/statuses?dfac_id=abc');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({statuses: {'123': 'solved'}});
    expect(res.body.degraded).toBeUndefined();
  });

  // Without the degraded flag the client can't tell this from "played nothing"
  // and persists the empty map, wiping the guest's badges.
  it.each([
    ['statement timeout', statementTimeout],
    ['pool acquire timeout', poolAcquireTimeout],
  ])('flags an empty status map as degraded on a %s', async (_label, makeError) => {
    mockGetGuestPuzzleStatuses.mockRejectedValue(makeError());

    const res = await request(buildApp()).get('/user-games/statuses?dfac_id=abc');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({statuses: {}, degraded: true});
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('propagates a non-transient failure to the error handler', async () => {
    mockGetGuestPuzzleStatuses.mockRejectedValue(new Error('boom'));

    const res = await request(buildApp()).get('/user-games/statuses?dfac_id=abc');

    expect(res.status).toBe(500);
    expect(res.body.degraded).toBeUndefined();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
