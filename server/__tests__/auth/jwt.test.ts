import jwt from 'jsonwebtoken';
import {signAccessToken, verifyAccessToken, isAccessTokenPayloadLive, JwtPayload} from '../../auth/jwt';
import {revokeAccessTokensForUser, resetAccessRevocationsForTests} from '../../auth/access_revocation';

describe('signAccessToken', () => {
  it('returns a non-empty string', () => {
    const token = signAccessToken({userId: 'u1', email: 'a@b.com', displayName: 'Alice'});
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('produces a token that verifyAccessToken can decode', () => {
    const payload: JwtPayload = {userId: 'u1', email: 'a@b.com', displayName: 'Alice'};
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe('u1');
    expect(decoded!.email).toBe('a@b.com');
    expect(decoded!.displayName).toBe('Alice');
  });

  it('works with null email', () => {
    const token = signAccessToken({userId: 'u1', email: null, displayName: 'Alice'});
    const decoded = verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.email).toBeNull();
  });

  it('works with null displayName', () => {
    const token = signAccessToken({userId: 'u1', email: 'a@b.com', displayName: null});
    const decoded = verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.displayName).toBeNull();
  });

  it('includes iat and exp fields in the token', () => {
    const token = signAccessToken({userId: 'u1', email: null, displayName: null});
    const raw = jwt.decode(token) as any;
    expect(raw.iat).toBeDefined();
    expect(raw.exp).toBeDefined();
    expect(raw.exp).toBeGreaterThan(raw.iat);
  });
});

describe('verifyAccessToken', () => {
  it('returns null for a garbage token', () => {
    expect(verifyAccessToken('not-a-real-token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyAccessToken('')).toBeNull();
  });

  it('returns null for an expired token', () => {
    const secret = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
    const token = jwt.sign({userId: 'u1', email: null, displayName: null}, secret, {expiresIn: '0s'});
    expect(verifyAccessToken(token)).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const token = jwt.sign({userId: 'u1', email: null, displayName: null}, 'wrong-secret', {
      expiresIn: '15m',
    });
    expect(verifyAccessToken(token)).toBeNull();
  });

  it('returns the original payload fields', () => {
    const payload: JwtPayload = {userId: 'user-42', email: 'test@example.com', displayName: 'Test User'};
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).toMatchObject(payload);
  });
});

describe('access token revocation', () => {
  afterEach(() => {
    resetAccessRevocationsForTests();
    jest.useRealTimers();
  });

  it("rejects a token issued before the user's tokens were revoked", () => {
    jest.useFakeTimers({now: new Date('2026-01-01T00:00:00Z')});
    const token = signAccessToken({userId: 'u1', email: null, displayName: null});
    jest.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    revokeAccessTokensForUser('u1');
    expect(verifyAccessToken(token)).toBeNull();
  });

  it('accepts a token issued after the revocation', () => {
    jest.useFakeTimers({now: new Date('2026-01-01T00:00:00Z')});
    revokeAccessTokensForUser('u1');
    jest.setSystemTime(new Date('2026-01-01T00:00:01Z'));
    const token = signAccessToken({userId: 'u1', email: null, displayName: null});
    expect(verifyAccessToken(token)).not.toBeNull();
  });

  it('accepts the replacement issued in the same second as the revocation', () => {
    // change-password revokes and then signs the caller's new token at once
    jest.useFakeTimers({now: new Date('2026-01-01T00:00:00.100Z')});
    revokeAccessTokensForUser('u1');
    jest.setSystemTime(new Date('2026-01-01T00:00:00.900Z'));
    const token = signAccessToken({userId: 'u1', email: null, displayName: null});
    expect(verifyAccessToken(token)).not.toBeNull();
  });

  it("does not affect other users' tokens", () => {
    jest.useFakeTimers({now: new Date('2026-01-01T00:00:00Z')});
    const token = signAccessToken({userId: 'u2', email: null, displayName: null});
    jest.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    revokeAccessTokensForUser('u1');
    expect(verifyAccessToken(token)).not.toBeNull();
  });
});

describe('isAccessTokenPayloadLive', () => {
  afterEach(() => {
    resetAccessRevocationsForTests();
  });

  it('is true for an unexpired, unrevoked payload', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(
      isAccessTokenPayloadLive({userId: 'u1', email: null, displayName: null, iat: nowSec, exp: nowSec + 60})
    ).toBe(true);
  });

  it('is false once the payload has expired', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(
      isAccessTokenPayloadLive({
        userId: 'u1',
        email: null,
        displayName: null,
        iat: nowSec - 900,
        exp: nowSec - 1,
      })
    ).toBe(false);
  });

  it("is false once the user's tokens are revoked", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {userId: 'u1', email: null, displayName: null, iat: nowSec - 10, exp: nowSec + 600};
    revokeAccessTokensForUser('u1');
    expect(isAccessTokenPayloadLive(payload)).toBe(false);
  });
});
