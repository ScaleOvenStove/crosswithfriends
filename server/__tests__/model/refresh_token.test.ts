import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
} from '../../model/refresh_token';

describe('createRefreshToken', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('returns a 96-character hex string', async () => {
    const token = await createRefreshToken('user-1');
    expect(token).toMatch(/^[0-9a-f]{96}$/);
  });

  it('stores a SHA-256 hash (not the raw token) in the INSERT', async () => {
    const token = await createRefreshToken('user-1');
    const params = pool.query.mock.calls[0][1] as any[];
    const storedHash = params[1];
    // Hash should be 64-char hex (SHA-256), not the 96-char raw token
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedHash).not.toBe(token);
  });

  it('computes correct expiration from expiresInDays', async () => {
    const before = Date.now();
    await createRefreshToken('user-1', 14);
    const after = Date.now();
    const params = pool.query.mock.calls[0][1] as any[];
    const expiresAt = new Date(params[2]).getTime();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(before + fourteenDaysMs);
    expect(expiresAt).toBeLessThanOrEqual(after + fourteenDaysMs);
  });
});

describe('validateRefreshToken', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns user_id for a valid non-expired non-revoked token', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    pool.query.mockResolvedValueOnce({
      rows: [{user_id: 'user-1', expires_at: futureDate, revoked_at: null}],
    });
    const result = await validateRefreshToken('some-token');
    expect(result).toBe('user-1');
  });

  it('returns null when token is not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await validateRefreshToken('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when token is revoked', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: new Date().toISOString(),
        },
      ],
    });
    const result = await validateRefreshToken('revoked-token');
    expect(result).toBeNull();
  });

  it('returns null when token is expired', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {user_id: 'user-1', expires_at: new Date(Date.now() - 86400000).toISOString(), revoked_at: null},
      ],
    });
    const result = await validateRefreshToken('expired-token');
    expect(result).toBeNull();
  });
});

describe('revokeRefreshToken', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('issues UPDATE with the hashed token', async () => {
    await revokeRefreshToken('some-raw-token');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE refresh_tokens');
    expect(sql).toContain('revoked_at');
    const params = pool.query.mock.calls[0][1] as any[];
    // Should pass hash, not raw token
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[0]).not.toBe('some-raw-token');
  });
});

describe('revokeAllUserTokens', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('issues UPDATE for all non-revoked tokens for the user', async () => {
    await revokeAllUserTokens('user-1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE refresh_tokens');
    expect(sql).toContain('revoked_at IS NULL');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('user-1');
  });
});

describe('cleanupExpiredTokens', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns rowCount from DELETE query', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 5});
    const result = await cleanupExpiredTokens();
    expect(result).toBe(5);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM refresh_tokens');
  });
});
