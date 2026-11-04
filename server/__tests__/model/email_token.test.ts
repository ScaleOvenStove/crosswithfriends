import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  createVerificationToken,
  validateVerificationToken,
  wasVerificationTokenRecentlyCreated,
  createPasswordResetToken,
  validatePasswordResetToken,
  cleanupExpiredEmailTokens,
  cleanupExpiredResetTokens,
} from '../../model/email_token';

describe('createVerificationToken', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('invalidates existing unused tokens first', async () => {
    await createVerificationToken('user-1');
    expect(pool.query).toHaveBeenCalledTimes(2);
    const firstSql = pool.query.mock.calls[0][0] as string;
    expect(firstSql).toContain('UPDATE email_verification_tokens');
    expect(firstSql).toContain('used_at = NOW()');
  });

  it('stores a hashed token (not raw) in the INSERT', async () => {
    const rawToken = await createVerificationToken('user-1');
    const insertParams = pool.query.mock.calls[1][1] as any[];
    const storedHash = insertParams[1];
    expect(storedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedHash).not.toBe(rawToken);
  });

  it('passes newEmail parameter or null', async () => {
    await createVerificationToken('user-1', 'new@email.com');
    const insertParams = pool.query.mock.calls[1][1] as any[];
    expect(insertParams[2]).toBe('new@email.com');

    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
    await createVerificationToken('user-1');
    const insertParams2 = pool.query.mock.calls[1][1] as any[];
    expect(insertParams2[2]).toBeNull();
  });
});

describe('validateVerificationToken', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns {userId, newEmail} when the token is claimed', async () => {
    pool.query.mockResolvedValueOnce({rows: [{user_id: 'user-1', new_email: 'new@test.com'}]});
    const result = await validateVerificationToken('some-token');
    expect(result).toEqual({userId: 'user-1', newEmail: 'new@test.com'});
  });

  it('returns null when no unused, unexpired token matches', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await validateVerificationToken('used-expired-or-missing')).toBeNull();
  });

  it('checks and claims the token in one conditional UPDATE', async () => {
    pool.query.mockResolvedValueOnce({rows: [{user_id: 'user-1', new_email: null}]});
    await validateVerificationToken('valid-token');
    // A separate SELECT-then-UPDATE lets two concurrent requests both
    // redeem the same token; the claim must be a single statement.
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('UPDATE email_verification_tokens SET used_at = NOW()');
    expect(sql).toContain('used_at IS NULL');
    expect(sql).toContain('expires_at > NOW()');
    expect(sql).toContain('RETURNING');
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[0]).not.toBe('valid-token');
  });
});

describe('wasVerificationTokenRecentlyCreated', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns true when rows exist', async () => {
    pool.query.mockResolvedValueOnce({rows: [{}]});
    const result = await wasVerificationTokenRecentlyCreated('user-1');
    expect(result).toBe(true);
  });

  it('returns false when no rows', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await wasVerificationTokenRecentlyCreated('user-1');
    expect(result).toBe(false);
  });
});

describe('createPasswordResetToken', () => {
  beforeEach(() => {
    resetPoolMocks();
    pool.query.mockResolvedValue({rows: []});
  });

  it('invalidates existing unused reset tokens before creating', async () => {
    await createPasswordResetToken('user-1');
    expect(pool.query).toHaveBeenCalledTimes(2);
    const firstSql = pool.query.mock.calls[0][0] as string;
    expect(firstSql).toContain('UPDATE password_reset_tokens');
    expect(firstSql).toContain('used_at = NOW()');
  });

  it('returns a 96-character hex token', async () => {
    const token = await createPasswordResetToken('user-1');
    expect(token).toMatch(/^[0-9a-f]{96}$/);
  });
});

describe('validatePasswordResetToken', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns {userId} when the token is claimed', async () => {
    pool.query.mockResolvedValueOnce({rows: [{user_id: 'user-1'}]});
    expect(await validatePasswordResetToken('valid-token')).toEqual({userId: 'user-1'});
  });

  it('returns null when no unused, unexpired token matches', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await validatePasswordResetToken('used-expired-or-missing')).toBeNull();
  });

  it('checks and claims the token in one conditional UPDATE', async () => {
    pool.query.mockResolvedValueOnce({rows: [{user_id: 'user-1'}]});
    await validatePasswordResetToken('valid-token');
    expect(pool.query).toHaveBeenCalledTimes(1);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE password_reset_tokens SET used_at = NOW()');
    expect(sql).toContain('used_at IS NULL');
    expect(sql).toContain('expires_at > NOW()');
    expect(sql).toContain('RETURNING');
  });
});

describe('cleanupExpiredEmailTokens', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns rowCount from DELETE', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 3});
    const result = await cleanupExpiredEmailTokens();
    expect(result).toBe(3);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM email_verification_tokens');
  });
});

describe('cleanupExpiredResetTokens', () => {
  beforeEach(() => {
    resetPoolMocks();
  });

  it('returns rowCount from DELETE', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 7});
    const result = await cleanupExpiredResetTokens();
    expect(result).toBe(7);
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM password_reset_tokens');
  });
});
