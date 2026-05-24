import {pool, mockClient, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  rotateRefreshToken,
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

describe('rotateRefreshToken', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  const future = () => new Date(Date.now() + 86400000).toISOString();

  it('rotates a valid token: revokes old, inserts new, commits, returns new raw token', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{id: 'tok-1', user_id: 'user-1', expires_at: future(), revoked_at: null}],
      })
      .mockResolvedValueOnce({}) // UPDATE revoke old
      .mockResolvedValueOnce({}) // INSERT new
      .mockResolvedValueOnce({}); // COMMIT

    const result = await rotateRefreshToken('raw-token');
    expect(result).toEqual({
      status: 'rotated',
      userId: 'user-1',
      token: expect.stringMatching(/^[0-9a-f]{96}$/),
    });

    const sqls = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[1]).toContain('FOR UPDATE');
    expect(sqls.some((s) => /UPDATE refresh_tokens SET revoked_at/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO refresh_tokens/.test(s))).toBe(true);
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns invalid and rolls back when the token is not found', async () => {
    mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows: []});
    const result = await rotateRefreshToken('missing');
    expect(result).toEqual({status: 'invalid'});
    const sqls = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(sqls).toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns invalid (benign) without revoking the family when revoked within the grace window', async () => {
    mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({
      rows: [{id: 'tok-1', user_id: 'user-1', expires_at: future(), revoked_at: new Date().toISOString()}],
    });
    const result = await rotateRefreshToken('recently-rotated');
    expect(result).toEqual({status: 'invalid'});
    const sqls = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => /revoked_at IS NULL/.test(s))).toBe(false); // no family revocation
    expect(sqls).toContain('ROLLBACK');
  });

  it('detects reuse and revokes the whole family when revoked long ago', async () => {
    const longAgo = new Date(Date.now() - 60_000).toISOString();
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{id: 'tok-1', user_id: 'user-1', expires_at: future(), revoked_at: longAgo}],
      })
      .mockResolvedValueOnce({}) // UPDATE family revoke
      .mockResolvedValueOnce({}); // COMMIT
    const result = await rotateRefreshToken('stolen-replayed');
    expect(result).toEqual({status: 'reuse', userId: 'user-1'});
    const sqls = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => /revoked_at IS NULL/.test(s))).toBe(true);
    expect(sqls).toContain('COMMIT');
  });

  it('returns invalid when the token is expired', async () => {
    mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({
      rows: [
        {
          id: 'tok-1',
          user_id: 'user-1',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          revoked_at: null,
        },
      ],
    });
    const result = await rotateRefreshToken('expired');
    expect(result).toEqual({status: 'invalid'});
    expect(mockClient.query.mock.calls.map((c) => c[0] as string)).toContain('ROLLBACK');
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
