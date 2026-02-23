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

  it('returns {userId, newEmail} for a valid unused token', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    pool.query
      .mockResolvedValueOnce({
        rows: [{user_id: 'user-1', new_email: 'new@test.com', expires_at: futureDate, used_at: null}],
      })
      .mockResolvedValueOnce({rows: []}); // mark as used
    const result = await validateVerificationToken('some-token');
    expect(result).toEqual({userId: 'user-1', newEmail: 'new@test.com'});
  });

  it('returns null when token is not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await validateVerificationToken('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when token is already used', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          new_email: null,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          used_at: new Date().toISOString(),
        },
      ],
    });
    const result = await validateVerificationToken('used-token');
    expect(result).toBeNull();
  });

  it('returns null when token is expired', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'user-1',
          new_email: null,
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          used_at: null,
        },
      ],
    });
    const result = await validateVerificationToken('expired-token');
    expect(result).toBeNull();
  });

  it('marks token as used after successful validation', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    pool.query
      .mockResolvedValueOnce({
        rows: [{user_id: 'user-1', new_email: null, expires_at: futureDate, used_at: null}],
      })
      .mockResolvedValueOnce({rows: []});

    await validateVerificationToken('valid-token');
    expect(pool.query).toHaveBeenCalledTimes(2);
    const markUsedSql = pool.query.mock.calls[1][0] as string;
    expect(markUsedSql).toContain('UPDATE email_verification_tokens');
    expect(markUsedSql).toContain('used_at = NOW()');
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

  it('returns {userId} for a valid token and marks as used', async () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    pool.query
      .mockResolvedValueOnce({
        rows: [{user_id: 'user-1', expires_at: futureDate, used_at: null}],
      })
      .mockResolvedValueOnce({rows: []});
    const result = await validatePasswordResetToken('valid-token');
    expect(result).toEqual({userId: 'user-1'});
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('returns null for used/expired/missing token', async () => {
    // missing
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await validatePasswordResetToken('missing')).toBeNull();

    // used
    resetPoolMocks();
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'u1',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          used_at: new Date().toISOString(),
        },
      ],
    });
    expect(await validatePasswordResetToken('used')).toBeNull();

    // expired
    resetPoolMocks();
    pool.query.mockResolvedValueOnce({
      rows: [{user_id: 'u1', expires_at: new Date(Date.now() - 3600000).toISOString(), used_at: null}],
    });
    expect(await validatePasswordResetToken('expired')).toBeNull();
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
