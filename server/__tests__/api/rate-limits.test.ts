import express from 'express';
import request from 'supertest';

/**
 * Rate limiting, exercised against the routers that actually serve traffic.
 *
 * The point is to catch a limiter being detached from a route or silently
 * reconfigured. A test that builds its own Express app and re-declares the
 * limiter config proves only that express-rate-limit works — it stays green
 * when someone deletes `strictLimiter` from `/auth/login`. So every case here
 * mounts the real router and drives real requests through it.
 *
 * Each test gets fresh limiter instances via jest.resetModules(), since the
 * counters live in module scope and would otherwise leak between tests.
 */

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));
jest.mock('@sentry/node', () => ({captureException: jest.fn()}));

// --- auth router dependencies -------------------------------------------
const mockCreateLocalUser = jest.fn();
const mockGetUserProfile = jest.fn();
jest.mock('../../model/user', () => ({
  createLocalUser: (...a: unknown[]) => mockCreateLocalUser(...a),
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
  findUserByEmail: jest.fn().mockResolvedValue(null),
  updateDisplayName: jest.fn(),
  updateEmail: jest.fn(),
  updatePasswordHash: jest.fn(),
  setPasswordHash: jest.fn(),
  linkGoogleAccount: jest.fn(),
  unlinkGoogleAccount: jest.fn(),
  softDeleteUser: jest.fn(),
  verifyPassword: jest.fn().mockResolvedValue(true),
  markEmailVerified: jest.fn(),
  linkDfacId: jest.fn(),
  updateProfileVisibility: jest.fn(),
  updateUserPreferences: jest.fn(),
  EmailCollisionError: class EmailCollisionError extends Error {},
}));
jest.mock('../../model/refresh_token', () => ({
  createRefreshToken: jest.fn().mockResolvedValue('refresh'),
  rotateRefreshToken: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
}));
jest.mock('../../model/email_token', () => ({
  createVerificationToken: jest.fn().mockResolvedValue('tok'),
  validateVerificationToken: jest.fn(),
  wasVerificationTokenRecentlyCreated: jest.fn().mockResolvedValue(false),
  createPasswordResetToken: jest.fn().mockResolvedValue('tok'),
  validatePasswordResetToken: jest.fn(),
}));
jest.mock('../../model/mailer', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../model/puzzle_solve', () => ({
  backfillSolvesForDfacId: jest.fn().mockResolvedValue(0),
  invalidateSolvedPidsCacheForUser: jest.fn(),
  getPuzzleSolves: jest.fn().mockResolvedValue([]),
  invalidateInProgressCacheForUser: jest.fn(),
}));
jest.mock('../../model/user_games', () => ({
  invalidateAuthPuzzleStatusCache: jest.fn(),
  invalidateUserGamesCacheForUser: jest.fn(),
  invalidateUserGamesCacheForUserId: jest.fn(),
}));
jest.mock('../../auth/passport', () => ({
  __esModule: true,
  default: {authenticate: () => (_r: unknown, _s: unknown, next: () => void) => next()},
}));

// --- game / puzzle / rating router dependencies --------------------------
jest.mock('../../model/game', () => ({addInitialGameEvent: jest.fn().mockResolvedValue('gid-1')}));
jest.mock('../../model/puzzle', () => ({
  addPuzzle: jest.fn().mockResolvedValue('pid-1'),
  getPuzzleInfo: jest.fn().mockResolvedValue({}),
  getPuzzleStats: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../model/game_dismissal', () => ({
  dismissGameForUser: jest.fn(),
  undismissGameForUser: jest.fn(),
}));
jest.mock('../../model/game_moderation', () => {
  const actual = jest.requireActual('../../model/game_moderation');
  return {
    ...actual,
    getGameOwner: jest.fn().mockResolvedValue(null),
    isGameLocked: jest.fn().mockResolvedValue(false),
    getKickedDfacIds: jest.fn().mockResolvedValue([]),
    getGameRestrictions: jest.fn().mockResolvedValue({check: false, reveal: false, reset: false}),
  };
});
jest.mock('../../socket_instance', () => ({getSocketIo: () => null}));
jest.mock('../../model/puzzle_rating', () => ({
  getRatingForPuzzle: jest.fn().mockResolvedValue({}),
  upsertRating: jest.fn(),
  deleteRating: jest.fn(),
  hasReachedRatingThreshold: jest.fn().mockResolvedValue(true),
  RATING_THRESHOLD_PERCENT: 50,
}));

import {signAccessToken} from '../../auth/jwt';

const TOKEN = signAccessToken({userId: 'rl-user', email: 'a@b.com', displayName: 'A'});

/**
 * Mount one real router on a fresh app with fresh limiter state, in the same
 * middleware order server.ts uses.
 *
 * `optionalAuth` matters here: authLimiter and emailLimiter key on
 * `req.authUser?.userId`, but they sit *before* `requireAuth` in the route
 * chain, so the only thing that populates `req.authUser` in time is the
 * app-level `app.use(optionalAuth)` in server.ts. Drop that line and every
 * authenticated caller silently falls back to sharing one per-IP bucket.
 */
function mount(modulePath: string, base: string) {
  jest.resetModules();
  const {optionalAuth} = require('../../auth/middleware');
  const router = require(modulePath).default;
  const app = express();
  app.use(express.json());
  app.use(optionalAuth);
  app.use(base, router);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({error: err.message}));
  return app;
}

/**
 * Fire `count` sequential requests and return their statuses. Sequential
 * rather than parallel so the limiter's counter is deterministic.
 */
async function fire(
  app: express.Express,
  count: number,
  send: (agent: request.Agent) => request.Test
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await send(request(app));
    statuses.push(res.status);
  }
  return statuses;
}

beforeEach(() => {
  mockCreateLocalUser.mockResolvedValue({
    id: 'rl-user',
    email: 'a@b.com',
    display_name: 'A',
    email_verified_at: null,
    auth_provider: 'local',
    password_hash: 'h',
    has_password: true,
  });
  mockGetUserProfile.mockResolvedValue({
    id: 'rl-user',
    email: 'a@b.com',
    display_name: 'A',
    email_verified_at: null,
    auth_provider: 'local',
    password_hash: 'h',
    has_password: true,
    preferences: {},
  });
});

// ---------------------------------------------------------------------------

describe('auth strictLimiter (10 / 15 min)', () => {
  const signup = (n: number) => (agent: request.Agent) =>
    agent.post('/auth/signup').send({email: `rl${n}@b.com`, password: 'longenough1', displayName: 'A'});

  it('allows 10 requests and blocks the 11th on /auth/signup', async () => {
    const app = mount('../../api/auth', '/auth');
    let i = 0;
    const statuses = await fire(app, 11, () => {
      i += 1;
      return signup(i)(request(app));
    });

    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('returns the configured message body when blocked', async () => {
    const app = mount('../../api/auth', '/auth');
    let i = 0;
    await fire(app, 10, () => {
      i += 1;
      return signup(i)(request(app));
    });

    const blocked = await request(app)
      .post('/auth/signup')
      .send({email: 'over@b.com', password: 'longenough1', displayName: 'A'});

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({error: 'Too many requests, please try again later'});
  });

  it('is still attached to /auth/login', async () => {
    const app = mount('../../api/auth', '/auth');
    const login = (agent: request.Agent) =>
      agent.post('/auth/login').send({email: 'a@b.com', password: 'whatever'});

    const statuses = await fire(app, 11, login);

    expect(statuses[10]).toBe(429);
  });

  it('shares one budget across every strict-limited route', async () => {
    // signup, login, verify-email, reset-password and the Google entry point
    // all pass through the same limiter instance, so an attacker cannot get
    // 10 more attempts by switching endpoints.
    const app = mount('../../api/auth', '/auth');
    await fire(app, 10, (agent) => agent.post('/auth/login').send({email: 'a@b.com', password: 'x'}));

    const signupAfter = await request(app)
      .post('/auth/signup')
      .send({email: 'fresh@b.com', password: 'longenough1', displayName: 'A'});
    const resetAfter = await request(app).post('/auth/reset-password').send({token: 't', newPassword: 'x'});

    expect(signupAfter.status).toBe(429);
    expect(resetAfter.status).toBe(429);
  });

  it('counts rejected attempts, so wrong credentials still consume budget', async () => {
    // A limiter that only counted successes would be useless against
    // credential stuffing.
    const app = mount('../../api/auth', '/auth');
    const statuses = await fire(app, 11, (agent) => agent.post('/auth/login').send({email: 'bad'}));

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400));
    expect(statuses[10]).toBe(429);
  });
});

describe('auth emailLimiter (5 / 15 min)', () => {
  it('allows 5 requests and blocks the 6th on /auth/forgot-password', async () => {
    const app = mount('../../api/auth', '/auth');
    const statuses = await fire(app, 6, (agent) =>
      agent.post('/auth/forgot-password').send({email: 'a@b.com'})
    );

    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('is stricter than the strict limiter, so email endpoints run out first', async () => {
    const app = mount('../../api/auth', '/auth');
    const statuses = await fire(app, 11, (agent) =>
      agent.post('/auth/forgot-password').send({email: 'a@b.com'})
    );

    expect(statuses[5]).toBe(429);
  });

  it('is attached to /auth/resend-verification', async () => {
    const app = mount('../../api/auth', '/auth');
    const statuses = await fire(app, 6, (agent) =>
      agent.post('/auth/resend-verification').set('Authorization', `Bearer ${TOKEN}`)
    );

    expect(statuses[5]).toBe(429);
  });
});

describe('auth authLimiter (30 / 15 min)', () => {
  it('allows 30 requests and blocks the 31st', async () => {
    const app = mount('../../api/auth', '/auth');
    const statuses = await fire(app, 31, (agent) =>
      agent
        .post('/auth/change-display-name')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({displayName: 'Name'})
    );

    expect(statuses.slice(0, 30).every((s) => s !== 429)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('keys authenticated callers separately, so one user cannot exhaust another', async () => {
    // Both callers share an IP (supertest is always 127.0.0.1), so this only
    // passes if the limiter is really keying on the user id.
    const app = mount('../../api/auth', '/auth');
    const other = signAccessToken({userId: 'rl-user-2', email: 'c@d.com', displayName: 'C'});

    await fire(app, 31, (agent) =>
      agent
        .post('/auth/change-display-name')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({displayName: 'Name'})
    );
    const otherUser = await request(app)
      .post('/auth/change-display-name')
      .set('Authorization', `Bearer ${other}`)
      .send({displayName: 'Name'});

    expect(otherUser.status).toBe(200);
  });
});

describe('puzzle_rating ratingLimiter (30 / 15 min)', () => {
  it('allows 30 rating writes and blocks the 31st', async () => {
    const app = mount('../../api/puzzle_rating', '/puzzle_rating');
    const statuses = await fire(app, 31, (agent) =>
      agent.post('/puzzle_rating/p1').set('Authorization', `Bearer ${TOKEN}`).send({rating: 4})
    );

    expect(statuses.slice(0, 30).every((s) => s !== 429)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('covers the DELETE route from the same budget', async () => {
    const app = mount('../../api/puzzle_rating', '/puzzle_rating');
    await fire(app, 30, (agent) =>
      agent.post('/puzzle_rating/p1').set('Authorization', `Bearer ${TOKEN}`).send({rating: 4})
    );

    const del = await request(app).delete('/puzzle_rating/p1').set('Authorization', `Bearer ${TOKEN}`);

    expect(del.status).toBe(429);
  });
});

describe('health healthLimiter (60 / hour)', () => {
  it('allows 60 probes and blocks the 61st', async () => {
    const app = mount('../../api/health', '/health');
    const statuses = await fire(app, 61, (agent) => agent.get('/health/email'));

    expect(statuses.slice(0, 60).every((s) => s !== 429)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('uses the health-specific message shape', async () => {
    const app = mount('../../api/health', '/health');
    await fire(app, 60, (agent) => agent.get('/health/email'));

    const blocked = await request(app).get('/health/email');

    expect(blocked.body).toEqual({status: 'rate_limited'});
  });
});

/**
 * Three limiters opt out under NODE_ENV=test or DISABLE_RATE_LIMITS so the
 * e2e and load suites can drive traffic freely. Both halves are pinned here:
 * the opt-out works, and the limiter really does engage without it.
 */
describe('limiters that skip themselves in test environments', () => {
  const cases: Array<[string, string, number, (agent: request.Agent) => request.Test]> = [
    [
      'game create (20 / 15 min)',
      'game',
      20,
      (agent) => agent.post('/game').send({gid: 'g', pid: 'p', dfac_id: 'd'}),
    ],
    [
      'puzzle upload (20 / hour)',
      'puzzle',
      20,
      (agent) => agent.post('/puzzle').send({puzzle: {}, pid: 'p', isPublic: true}),
    ],
  ];

  it.each(cases)('%s does not limit under NODE_ENV=test', async (_label, base, limit, send) => {
    const app = mount(`../../api/${base}`, `/${base}`);
    const statuses = await fire(app, limit + 5, send);

    expect(statuses.includes(429)).toBe(false);
  });

  it.each(cases)('%s limits once the skip no longer applies', async (_label, base, limit, send) => {
    const previous = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';
    try {
      const app = mount(`../../api/${base}`, `/${base}`);
      const statuses = await fire(app, limit + 1, send);

      expect(statuses.slice(0, limit).every((s) => s !== 429)).toBe(true);
      expect(statuses[limit]).toBe(429);
    } finally {
      (process.env as any).NODE_ENV = previous;
    }
  });

  it('the global /api limiter skips under NODE_ENV=test', async () => {
    jest.resetModules();
    const {globalLimiter} = require('../../api/limiters');
    const app = express();
    app.use('/api', globalLimiter);
    app.get('/api/ping', (_req: express.Request, res: express.Response) => res.json({ok: true}));

    const statuses = await fire(app, 5, (agent) => agent.get('/api/ping'));

    expect(statuses).toEqual(Array(5).fill(200));
  });

  it('the global /api limiter advertises a 500-request budget when active', async () => {
    // 500 requests is too slow to drive here; the draft-7 RateLimit header
    // carries the configured limit, which is what a config regression changes.
    const previous = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';
    try {
      jest.resetModules();
      const {globalLimiter} = require('../../api/limiters');
      const app = express();
      app.use('/api', globalLimiter);
      app.get('/api/ping', (_req: express.Request, res: express.Response) => res.json({ok: true}));

      const res = await request(app).get('/api/ping');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit']).toContain('limit=500');
    } finally {
      (process.env as any).NODE_ENV = previous;
    }
  });

  it('DISABLE_RATE_LIMITS switches the global limiter off outside test', async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousFlag = process.env.DISABLE_RATE_LIMITS;
    (process.env as any).NODE_ENV = 'development';
    process.env.DISABLE_RATE_LIMITS = 'true';
    try {
      jest.resetModules();
      const {globalLimiter} = require('../../api/limiters');
      const app = express();
      app.use('/api', globalLimiter);
      app.get('/api/ping', (_req: express.Request, res: express.Response) => res.json({ok: true}));

      const res = await request(app).get('/api/ping');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit']).toBeUndefined();
    } finally {
      (process.env as any).NODE_ENV = previousEnv;
      if (previousFlag === undefined) delete process.env.DISABLE_RATE_LIMITS;
      else process.env.DISABLE_RATE_LIMITS = previousFlag;
    }
  });
});
