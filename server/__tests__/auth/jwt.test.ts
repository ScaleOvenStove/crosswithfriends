import jwt from 'jsonwebtoken';
import {signAccessToken, verifyAccessToken, JwtPayload} from '../../auth/jwt';

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
