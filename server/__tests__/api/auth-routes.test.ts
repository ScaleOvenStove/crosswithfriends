import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

/**
 * Route-level tests for api/auth.ts.
 *
 * These mount the real router — real Joi schemas, real requireAuth, real JWT
 * signing/verification — against a mocked model layer. The model functions are
 * covered by their own suites; what is pinned here is the HTTP contract:
 * status codes, validation boundaries, which routes demand a token, and the
 * security-relevant behaviours (email enumeration, session revocation on
 * password change, refresh-token rotation outcomes).
 */

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

// bcrypt at 12 rounds costs ~300ms per call; the hashing itself is not under
// test here, only that the route hashes before storing.
const mockBcryptHash = jest.fn().mockResolvedValue('hashed-new-password');
jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {hash: (...a: unknown[]) => mockBcryptHash(...a)},
  hash: (...a: unknown[]) => mockBcryptHash(...a),
}));

const userModel = {
  createLocalUser: jest.fn(),
  getUserProfile: jest.fn(),
  linkDfacId: jest.fn(),
  updateDisplayName: jest.fn(),
  updateEmail: jest.fn(),
  updatePasswordHash: jest.fn(),
  setPasswordHash: jest.fn(),
  linkGoogleAccount: jest.fn(),
  unlinkGoogleAccount: jest.fn(),
  softDeleteUser: jest.fn(),
  verifyPassword: jest.fn(),
  markEmailVerified: jest.fn(),
  findUserByEmail: jest.fn(),
  updateProfileVisibility: jest.fn(),
  updateUserPreferences: jest.fn(),
};
jest.mock('../../model/user', () => ({
  ...Object.fromEntries(
    Object.keys(userModel).map((k) => [k, (...a: unknown[]) => (userModel as any)[k](...a)])
  ),
  EmailCollisionError: class EmailCollisionError extends Error {},
}));

const refreshModel = {
  createRefreshToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
};
jest.mock('../../model/refresh_token', () =>
  Object.fromEntries(
    Object.keys(refreshModel).map((k) => [k, (...a: unknown[]) => (refreshModel as any)[k](...a)])
  )
);

const tokenModel = {
  createVerificationToken: jest.fn(),
  validateVerificationToken: jest.fn(),
  wasVerificationTokenRecentlyCreated: jest.fn(),
  createPasswordResetToken: jest.fn(),
  validatePasswordResetToken: jest.fn(),
};
jest.mock('../../model/email_token', () =>
  Object.fromEntries(
    Object.keys(tokenModel).map((k) => [k, (...a: unknown[]) => (tokenModel as any)[k](...a)])
  )
);

const mockSendVerificationEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
jest.mock('../../model/mailer', () => ({
  sendVerificationEmail: (...a: unknown[]) => mockSendVerificationEmail(...a),
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
}));

const mockBackfillSolves = jest.fn();
jest.mock('../../model/puzzle_solve', () => ({
  backfillSolvesForDfacId: (...a: unknown[]) => mockBackfillSolves(...a),
  invalidateSolvedPidsCacheForUser: jest.fn(),
}));
jest.mock('../../model/user_games', () => ({invalidateAuthPuzzleStatusCache: jest.fn()}));

/**
 * passport.authenticate(strategy, opts, cb) returns a middleware. The mock
 * returns one that immediately invokes cb with whatever the current test set.
 */
let passportResult: {err: unknown; user: unknown; info: unknown} = {err: null, user: false, info: null};
jest.mock('../../auth/passport', () => ({
  __esModule: true,
  default: {
    authenticate: (_strategy: string, _opts: unknown, cb?: (...a: unknown[]) => void) => {
      return (_req: unknown, _res: unknown, next: () => void) => {
        if (cb) cb(passportResult.err, passportResult.user, passportResult.info);
        else next();
      };
    },
  },
}));

jest.mock('@sentry/node', () => ({captureException: jest.fn()}));

import {signAccessToken} from '../../auth/jwt';

/** supertest types set-cookie as a string; express always sends an array. */
function cookies(res: {headers: Record<string, any>}): string {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.join() : (raw ?? '');
}

const USER_ID = 'user-1';

function tokenFor(userId = USER_ID): string {
  return signAccessToken({userId, email: 'a@b.com', displayName: 'A'});
}

/** A row as the user model returns it (snake_case, straight from Postgres). */
function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'a@b.com',
    display_name: 'A',
    email_verified_at: null,
    auth_provider: 'local',
    password_hash: 'stored-hash',
    has_password: true,
    has_google: false,
    oauth_id: null,
    profile_is_public: false,
    preferences: {},
    ...overrides,
  };
}

/**
 * Fresh app per call. resetModules gives each test its own rate-limiter
 * instances, so one test's requests cannot exhaust another's window.
 */
function buildApp() {
  jest.resetModules();
  const router = require('../../api/auth').default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', router);
  // Mirrors server.ts: next(err) must land somewhere deterministic.
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({error: String(err.message)}));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  passportResult = {err: null, user: false, info: null};
  mockBcryptHash.mockResolvedValue('hashed-new-password');
  userModel.getUserProfile.mockResolvedValue(userRow());
  userModel.verifyPassword.mockResolvedValue(true);
  userModel.findUserByEmail.mockResolvedValue(null);
  userModel.updateUserPreferences.mockImplementation((_id: string, prefs: unknown) => prefs);
  refreshModel.createRefreshToken.mockResolvedValue('refresh-token-value');
  refreshModel.revokeAllUserTokens.mockResolvedValue(undefined);
  tokenModel.createVerificationToken.mockResolvedValue('verify-token');
  tokenModel.wasVerificationTokenRecentlyCreated.mockResolvedValue(false);
  mockSendVerificationEmail.mockResolvedValue(undefined);
  mockSendPasswordResetEmail.mockResolvedValue(undefined);
  mockBackfillSolves.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------

describe('POST /auth/signup', () => {
  it('creates the account and returns a token plus a refresh cookie', async () => {
    userModel.createLocalUser.mockResolvedValue(userRow());

    const res = await request(buildApp())
      .post('/auth/signup')
      .send({email: 'a@b.com', password: 'longenough1', displayName: 'A'});

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({id: USER_ID, email: 'a@b.com', emailVerified: false});
    expect(cookies(res)).toContain('cwf_refresh=refresh-token-value');
  });

  it('never returns the password hash', async () => {
    userModel.createLocalUser.mockResolvedValue(userRow());

    const res = await request(buildApp())
      .post('/auth/signup')
      .send({email: 'a@b.com', password: 'longenough1', displayName: 'A'});

    expect(JSON.stringify(res.body)).not.toContain('stored-hash');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('scopes the refresh cookie to /api/auth and marks it httpOnly', async () => {
    userModel.createLocalUser.mockResolvedValue(userRow());

    const res = await request(buildApp())
      .post('/auth/signup')
      .send({email: 'a@b.com', password: 'longenough1', displayName: 'A'});

    const cookie = cookies(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('SameSite=Lax');
  });

  it.each([
    ['a malformed email', {email: 'not-an-email', password: 'longenough1', displayName: 'A'}],
    ['a password under 8 characters', {email: 'a@b.com', password: 'short', displayName: 'A'}],
    ['a password over 128 characters', {email: 'a@b.com', password: 'x'.repeat(129), displayName: 'A'}],
    ['an empty display name', {email: 'a@b.com', password: 'longenough1', displayName: ''}],
    [
      'a display name over 64 characters',
      {email: 'a@b.com', password: 'longenough1', displayName: 'x'.repeat(65)},
    ],
    ['a missing password', {email: 'a@b.com', displayName: 'A'}],
    ['an empty body', {}],
  ])('rejects %s', async (_label, body) => {
    const res = await request(buildApp()).post('/auth/signup').send(body);

    expect(res.status).toBe(400);
    expect(userModel.createLocalUser).not.toHaveBeenCalled();
  });

  it('maps a unique-violation to 409 rather than a 500', async () => {
    userModel.createLocalUser.mockRejectedValue(Object.assign(new Error('dup'), {code: '23505'}));

    const res = await request(buildApp())
      .post('/auth/signup')
      .send({email: 'a@b.com', password: 'longenough1', displayName: 'A'});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({error: 'An account with this email already exists'});
  });

  it('still succeeds when the verification email fails to send', async () => {
    // Signup must not fail because Resend is down.
    userModel.createLocalUser.mockResolvedValue(userRow());
    mockSendVerificationEmail.mockRejectedValue(new Error('resend down'));
    // The route logs the failure by design; keep it out of the test output.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await request(buildApp())
        .post('/auth/signup')
        .send({email: 'a@b.com', password: 'longenough1', displayName: 'A'});

      expect(res.status).toBe(200);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('POST /auth/login', () => {
  it('returns a token when the strategy authenticates the user', async () => {
    passportResult = {err: null, user: userRow(), info: null};

    const res = await request(buildApp()).post('/auth/login').send({email: 'a@b.com', password: 'whatever'});

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(cookies(res)).toContain('cwf_refresh=');
  });

  it('returns 401 when the strategy rejects the credentials', async () => {
    passportResult = {err: null, user: false, info: {message: 'Invalid email or password'}};

    const res = await request(buildApp()).post('/auth/login').send({email: 'a@b.com', password: 'wrong'});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'Invalid email or password'});
    expect(refreshModel.createRefreshToken).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed email', {email: 'nope', password: 'x'}],
    ['a missing password', {email: 'a@b.com'}],
    ['an empty body', {}],
  ])('rejects %s before touching the strategy', async (_label, body) => {
    const res = await request(buildApp()).post('/auth/login').send(body);
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  it('rejects a request with no refresh cookie', async () => {
    const res = await request(buildApp()).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'No refresh token'});
  });

  it('rotates the token and issues a new access token', async () => {
    refreshModel.validateRefreshToken.mockResolvedValue(USER_ID);
    refreshModel.rotateRefreshToken.mockResolvedValue({
      status: 'rotated',
      userId: USER_ID,
      token: 'next-token',
    });

    const res = await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=old-token');

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(cookies(res)).toContain('cwf_refresh=next-token');
  });

  it('asks the client to retry a lost rotation race without clearing the cookie', async () => {
    // A parallel /refresh already minted a fresh cookie; clearing here would
    // log the user out for no reason.
    refreshModel.validateRefreshToken.mockResolvedValue(USER_ID);
    refreshModel.rotateRefreshToken.mockResolvedValue({status: 'retry'});

    const res = await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=old-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'Refresh in progress, please retry', retry: true});
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('clears the cookie and flags a security issue when a token is replayed', async () => {
    refreshModel.validateRefreshToken.mockResolvedValue(null);
    refreshModel.rotateRefreshToken.mockResolvedValue({status: 'reuse'});

    const res = await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=replayed');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Session security issue detected, please log in again');
    expect(cookies(res)).toContain('cwf_refresh=;');
  });

  it('clears the cookie for a dead token', async () => {
    refreshModel.validateRefreshToken.mockResolvedValue(null);
    refreshModel.rotateRefreshToken.mockResolvedValue({status: 'invalid'});

    const res = await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=dead');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired refresh token');
    expect(cookies(res)).toContain('cwf_refresh=;');
  });

  it('rejects when the rotated token points at a user that no longer exists', async () => {
    refreshModel.validateRefreshToken.mockResolvedValue(null);
    refreshModel.rotateRefreshToken.mockResolvedValue({status: 'rotated', userId: 'ghost', token: 't'});
    userModel.getUserProfile.mockResolvedValue(null);

    const res = await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=old');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({error: 'User not found'});
  });

  it('reuses the pre-rotation profile lookup instead of fetching twice', async () => {
    refreshModel.validateRefreshToken.mockResolvedValue(USER_ID);
    refreshModel.rotateRefreshToken.mockResolvedValue({status: 'rotated', userId: USER_ID, token: 'next'});

    await request(buildApp()).post('/auth/refresh').set('Cookie', 'cwf_refresh=old');

    expect(userModel.getUserProfile).toHaveBeenCalledTimes(1);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the presented token and clears the cookie', async () => {
    const res = await request(buildApp()).post('/auth/logout').set('Cookie', 'cwf_refresh=tok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true});
    expect(refreshModel.revokeRefreshToken).toHaveBeenCalledWith('tok');
    expect(cookies(res)).toContain('cwf_refresh=;');
  });

  it('succeeds without a cookie so a double logout is not an error', async () => {
    const res = await request(buildApp()).post('/auth/logout');

    expect(res.status).toBe(200);
    expect(refreshModel.revokeRefreshToken).not.toHaveBeenCalled();
  });
});

describe('GET /auth/me', () => {
  it('requires a token', async () => {
    const res = await request(buildApp()).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a token that does not verify', async () => {
    const res = await request(buildApp()).get('/auth/me').set('Authorization', 'Bearer forged');
    expect(res.status).toBe(401);
  });

  it('returns the profile without the password hash', async () => {
    const res = await request(buildApp()).get('/auth/me').set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: USER_ID,
      email: 'a@b.com',
      displayName: 'A',
      emailVerified: false,
      authProvider: 'local',
      hasPassword: true,
      hasGoogle: false,
      profileIsPublic: false,
      preferences: {},
    });
    expect(JSON.stringify(res.body)).not.toContain('stored-hash');
  });

  it('returns 404 when the token is valid but the account is gone', async () => {
    userModel.getUserProfile.mockResolvedValue(null);

    const res = await request(buildApp()).get('/auth/me').set('Authorization', `Bearer ${tokenFor()}`);

    expect(res.status).toBe(404);
  });
});

describe('authenticated account mutations reject anonymous callers', () => {
  const PROTECTED: Array<['post' | 'put', string]> = [
    ['post', '/auth/change-display-name'],
    ['post', '/auth/profile-visibility'],
    ['put', '/auth/preferences'],
    ['post', '/auth/change-password'],
    ['post', '/auth/set-password'],
    ['post', '/auth/change-email'],
    ['post', '/auth/unlink-google'],
    ['post', '/auth/delete-account'],
    ['post', '/auth/resend-verification'],
    ['post', '/auth/link-identity'],
  ];

  it.each(PROTECTED)('%s %s returns 401 with no token', async (method, path) => {
    const res = await (request(buildApp()) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)('%s %s returns 401 with an unverifiable token', async (method, path) => {
    const res = await (request(buildApp()) as any)
      [method](path)
      .set('Authorization', 'Bearer forged.token.here')
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/change-display-name', () => {
  it('updates the name', async () => {
    const res = await request(buildApp())
      .post('/auth/change-display-name')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({displayName: 'New Name'});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true, displayName: 'New Name'});
    expect(userModel.updateDisplayName).toHaveBeenCalledWith(USER_ID, 'New Name');
  });

  it.each([
    ['an empty string', ''],
    ['a name over 64 characters', 'x'.repeat(65)],
    ['a non-string', 42],
    ['a missing field', undefined],
  ])('rejects %s', async (_label, displayName) => {
    const res = await request(buildApp())
      .post('/auth/change-display-name')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({displayName});

    expect(res.status).toBe(400);
    expect(userModel.updateDisplayName).not.toHaveBeenCalled();
  });
});

describe('POST /auth/profile-visibility', () => {
  it.each([true, false])('accepts the boolean %s', async (isPublic) => {
    const res = await request(buildApp())
      .post('/auth/profile-visibility')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({isPublic});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true, profileIsPublic: isPublic});
    expect(userModel.updateProfileVisibility).toHaveBeenCalledWith(USER_ID, isPublic);
  });

  it.each([
    ['the string "true"', 'true'],
    ['a number', 1],
    ['nothing', undefined],
  ])('rejects %s', async (_label, isPublic) => {
    const res = await request(buildApp())
      .post('/auth/profile-visibility')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({isPublic});

    expect(res.status).toBe(400);
    expect(userModel.updateProfileVisibility).not.toHaveBeenCalled();
  });
});

describe('PUT /auth/preferences', () => {
  it('accepts the documented preference keys', async () => {
    const prefs = {vimMode: true, darkMode: '2', sound: false, zenMode: true};

    const res = await request(buildApp())
      .put('/auth/preferences')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send(prefs);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true, preferences: prefs});
  });

  it('rejects an unknown key rather than silently storing it', async () => {
    const res = await request(buildApp())
      .put('/auth/preferences')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({isAdmin: true});

    expect(res.status).toBe(400);
    expect(userModel.updateUserPreferences).not.toHaveBeenCalled();
  });

  it('rejects a darkMode value outside the allowed set', async () => {
    const res = await request(buildApp())
      .put('/auth/preferences')
      .set('Authorization', `Bearer ${tokenFor()}`)
      .send({darkMode: '7'});

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/change-password', () => {
  const auth = () => `Bearer ${tokenFor()}`;

  it('hashes the new password, revokes every session, and issues fresh tokens', async () => {
    const res = await request(buildApp())
      .post('/auth/change-password')
      .set('Authorization', auth())
      .send({currentPassword: 'old', newPassword: 'newlongenough'});

    expect(res.status).toBe(200);
    expect(mockBcryptHash).toHaveBeenCalledWith('newlongenough', 12);
    expect(userModel.updatePasswordHash).toHaveBeenCalledWith(USER_ID, 'hashed-new-password');
    // Other devices must be logged out after a password change.
    expect(refreshModel.revokeAllUserTokens).toHaveBeenCalledWith(USER_ID);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects an incorrect current password without touching the stored hash', async () => {
    userModel.verifyPassword.mockResolvedValue(false);

    const res = await request(buildApp())
      .post('/auth/change-password')
      .set('Authorization', auth())
      .send({currentPassword: 'wrong', newPassword: 'newlongenough'});

    expect(res.status).toBe(401);
    expect(userModel.updatePasswordHash).not.toHaveBeenCalled();
    expect(refreshModel.revokeAllUserTokens).not.toHaveBeenCalled();
  });

  it.each([
    ['both fields missing', {}],
    ['no new password', {currentPassword: 'old'}],
    ['a new password under 8 characters', {currentPassword: 'old', newPassword: 'short'}],
    ['a new password over 128 characters', {currentPassword: 'old', newPassword: 'x'.repeat(129)}],
  ])('rejects %s', async (_label, body) => {
    const res = await request(buildApp())
      .post('/auth/change-password')
      .set('Authorization', auth())
      .send(body);

    expect(res.status).toBe(400);
    expect(userModel.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects an account that has no password to change', async () => {
    userModel.getUserProfile.mockResolvedValue(userRow({has_password: false, password_hash: null}));

    const res = await request(buildApp())
      .post('/auth/change-password')
      .set('Authorization', auth())
      .send({currentPassword: 'old', newPassword: 'newlongenough'});

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/change-email', () => {
  const auth = () => `Bearer ${tokenFor()}`;

  it('sends verification to the new address instead of changing it immediately', async () => {
    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'new@b.com', password: 'pw'});

    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith('new@b.com', 'verify-token', true);
    // The address must not move before the new one is proven.
    expect(userModel.updateEmail).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    userModel.verifyPassword.mockResolvedValue(false);

    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'new@b.com', password: 'wrong'});

    expect(res.status).toBe(401);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed address', {newEmail: 'not-an-email', password: 'pw'}],
    ['a missing address', {password: 'pw'}],
  ])('rejects %s', async (_label, body) => {
    const res = await request(buildApp()).post('/auth/change-email').set('Authorization', auth()).send(body);
    expect(res.status).toBe(400);
  });

  it('requires the password field', async () => {
    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'new@b.com'});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({error: 'Password is required to change email'});
  });

  it('reports a collision when the address belongs to someone else', async () => {
    userModel.findUserByEmail.mockResolvedValue({id: 'someone-else'});

    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'taken@b.com', password: 'pw'});

    expect(res.status).toBe(409);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('allows re-sending to the caller’s own address', async () => {
    userModel.findUserByEmail.mockResolvedValue({id: USER_ID});

    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'a@b.com', password: 'pw'});

    expect(res.status).toBe(200);
  });

  it('requires a password to be set on the account first', async () => {
    userModel.getUserProfile.mockResolvedValue(userRow({has_password: false, password_hash: null}));

    const res = await request(buildApp())
      .post('/auth/change-email')
      .set('Authorization', auth())
      .send({newEmail: 'new@b.com', password: 'pw'});

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/delete-account', () => {
  const auth = () => `Bearer ${tokenFor()}`;

  it('requires the password when the account has one', async () => {
    const res = await request(buildApp()).post('/auth/delete-account').set('Authorization', auth()).send({});

    expect(res.status).toBe(400);
    expect(userModel.softDeleteUser).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    userModel.verifyPassword.mockResolvedValue(false);

    const res = await request(buildApp())
      .post('/auth/delete-account')
      .set('Authorization', auth())
      .send({password: 'wrong'});

    expect(res.status).toBe(401);
    expect(userModel.softDeleteUser).not.toHaveBeenCalled();
  });

  it('deletes, revokes every session, and clears the cookie', async () => {
    const res = await request(buildApp())
      .post('/auth/delete-account')
      .set('Authorization', auth())
      .send({password: 'right'});

    expect(res.status).toBe(200);
    expect(refreshModel.revokeAllUserTokens).toHaveBeenCalledWith(USER_ID);
    expect(userModel.softDeleteUser).toHaveBeenCalledWith(USER_ID);
    expect(cookies(res)).toContain('cwf_refresh=;');
  });

  it('skips the password check for a Google-only account', async () => {
    userModel.getUserProfile.mockResolvedValue(userRow({has_password: false, password_hash: null}));

    const res = await request(buildApp()).post('/auth/delete-account').set('Authorization', auth()).send({});

    expect(res.status).toBe(200);
    expect(userModel.softDeleteUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe('POST /auth/forgot-password', () => {
  it('returns the same response whether or not the account exists', async () => {
    // Email enumeration guard — the two responses must be indistinguishable.
    userModel.findUserByEmail.mockResolvedValue(null);
    const missing = await request(buildApp()).post('/auth/forgot-password').send({email: 'nobody@b.com'});

    userModel.findUserByEmail.mockResolvedValue({id: USER_ID, email: 'a@b.com', password_hash: 'h'});
    tokenModel.createPasswordResetToken.mockResolvedValue('reset-token');
    const present = await request(buildApp()).post('/auth/forgot-password').send({email: 'a@b.com'});

    expect(missing.status).toBe(present.status);
    expect(missing.body).toEqual(present.body);
    expect(present.body.ok).toBe(true);
  });

  it('sends a reset email only for an account that can use one', async () => {
    userModel.findUserByEmail.mockResolvedValue({id: USER_ID, email: 'a@b.com', password_hash: 'h'});
    tokenModel.createPasswordResetToken.mockResolvedValue('reset-token');

    await request(buildApp()).post('/auth/forgot-password').send({email: 'a@b.com'});

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('a@b.com', 'reset-token');
  });

  it('sends nothing for a Google-only account but still returns 200', async () => {
    userModel.findUserByEmail.mockResolvedValue({id: USER_ID, email: 'a@b.com', password_hash: null});

    const res = await request(buildApp()).post('/auth/forgot-password').send({email: 'a@b.com'});

    expect(res.status).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('requires an email field', async () => {
    const res = await request(buildApp()).post('/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/reset-password', () => {
  it('resets the password and revokes every session', async () => {
    tokenModel.validatePasswordResetToken.mockResolvedValue({userId: USER_ID});

    const res = await request(buildApp())
      .post('/auth/reset-password')
      .send({token: 'reset-token', newPassword: 'newlongenough'});

    expect(res.status).toBe(200);
    expect(userModel.updatePasswordHash).toHaveBeenCalledWith(USER_ID, 'hashed-new-password');
    expect(refreshModel.revokeAllUserTokens).toHaveBeenCalledWith(USER_ID);
  });

  it('rejects an invalid or expired token', async () => {
    tokenModel.validatePasswordResetToken.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/auth/reset-password')
      .send({token: 'stale', newPassword: 'newlongenough'});

    expect(res.status).toBe(400);
    expect(userModel.updatePasswordHash).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing token', {newPassword: 'newlongenough'}],
    ['a password under 8 characters', {token: 't', newPassword: 'short'}],
    ['a password over 128 characters', {token: 't', newPassword: 'x'.repeat(129)}],
    ['a non-string token', {token: 42, newPassword: 'newlongenough'}],
  ])('rejects %s', async (_label, body) => {
    const res = await request(buildApp()).post('/auth/reset-password').send(body);

    expect(res.status).toBe(400);
    expect(userModel.updatePasswordHash).not.toHaveBeenCalled();
  });
});

describe('POST /auth/resend-verification', () => {
  const auth = () => `Bearer ${tokenFor()}`;

  it('sends a fresh verification email', async () => {
    const res = await request(buildApp()).post('/auth/resend-verification').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith('a@b.com', 'verify-token');
  });

  it('refuses when the address is already verified', async () => {
    userModel.getUserProfile.mockResolvedValue(userRow({email_verified_at: new Date().toISOString()}));

    const res = await request(buildApp()).post('/auth/resend-verification').set('Authorization', auth());

    expect(res.status).toBe(400);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('applies the 60-second cooldown on top of the route limiter', async () => {
    tokenModel.wasVerificationTokenRecentlyCreated.mockResolvedValue(true);

    const res = await request(buildApp()).post('/auth/resend-verification').set('Authorization', auth());

    expect(res.status).toBe(429);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('POST /auth/link-identity', () => {
  const auth = () => `Bearer ${tokenFor()}`;

  it('links the legacy id and reports the backfill count', async () => {
    mockBackfillSolves.mockResolvedValue(7);

    const res = await request(buildApp())
      .post('/auth/link-identity')
      .set('Authorization', auth())
      .send({dfacId: 'dfac-legacy'});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ok: true, backfilledSolves: 7});
    expect(userModel.linkDfacId).toHaveBeenCalledWith(USER_ID, 'dfac-legacy');
  });

  it.each([
    ['a missing dfacId', {}],
    ['a non-string dfacId', {dfacId: 99}],
    ['an empty dfacId', {dfacId: ''}],
  ])('rejects %s', async (_label, body) => {
    const res = await request(buildApp()).post('/auth/link-identity').set('Authorization', auth()).send(body);

    expect(res.status).toBe(400);
    expect(userModel.linkDfacId).not.toHaveBeenCalled();
  });
});

describe('GET /auth/google', () => {
  it('reports 501 when OAuth credentials are not configured', async () => {
    const {GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET} = process.env;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      const res = await request(buildApp()).get('/auth/google');
      expect(res.status).toBe(501);
    } finally {
      if (GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
      if (GOOGLE_CLIENT_SECRET) process.env.GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET;
    }
  });
});
