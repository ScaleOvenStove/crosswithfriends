import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mocked_hash_value'),
  compare: jest.fn(),
}));

import bcrypt from 'bcrypt';
import {
  createLocalUser,
  findUserByEmail,
  findOrCreateGoogleUser,
  getUserById,
  verifyPassword,
  linkDfacId,
  getDfacIdsForUser,
  getUserIdByDfacId,
  getUserProfile,
  updateDisplayName,
  updateEmail,
  updatePasswordHash,
  setPasswordHash,
  linkGoogleAccount,
  unlinkGoogleAccount,
  softDeleteUser,
  markEmailVerified,
  isEmailVerified,
  updateProfileVisibility,
  EmailCollisionError,
} from '../../model/user';

const mockUserRow = {
  id: 'u1',
  email: 'test@example.com',
  password_hash: '$2b$12$mocked_hash_value',
  display_name: 'Test User',
  auth_provider: 'local',
  oauth_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  email_verified_at: null,
  profile_is_public: true,
};

beforeEach(() => {
  resetPoolMocks();
  (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$mocked_hash_value');
  (bcrypt.compare as jest.Mock).mockReset();
});

describe('createLocalUser', () => {
  it('lowercases email before INSERT', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    await createLocalUser('Test@Example.COM', 'password123', 'Test');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('test@example.com');
  });

  it('stores bcrypt hash not plaintext password', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    await createLocalUser('a@b.com', 'my-secret', 'Test');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[1]).toBe('$2b$12$mocked_hash_value');
    expect(params[1]).not.toBe('my-secret');
  });

  it('returns the row from result', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    const result = await createLocalUser('a@b.com', 'password', 'Test');
    expect(result.id).toBe('u1');
    expect(result.email).toBe('test@example.com');
  });
});

describe('findUserByEmail', () => {
  it('lowercases email in query', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await findUserByEmail('Test@Example.COM');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('test@example.com');
  });

  it('returns null when no rows', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await findUserByEmail('notfound@test.com');
    expect(result).toBeNull();
  });

  it('returns row when found', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    const result = await findUserByEmail('test@example.com');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('u1');
  });
});

describe('findOrCreateGoogleUser', () => {
  it('returns existing user when found by oauth_id', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    const result = await findOrCreateGoogleUser('google-123', 'a@b.com', 'Test');
    expect(result.id).toBe('u1');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('throws EmailCollisionError when email is taken by another account', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no oauth match
      .mockResolvedValueOnce({rows: [{id: 'other-user', auth_provider: 'local'}]}); // email exists
    await expect(findOrCreateGoogleUser('google-new', 'taken@b.com', 'Test')).rejects.toThrow(
      EmailCollisionError
    );
  });

  it('creates new user when neither oauth_id nor email match', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no oauth match
      .mockResolvedValueOnce({rows: []}) // no email match
      .mockResolvedValueOnce({rows: [{...mockUserRow, auth_provider: 'google', oauth_id: 'google-new'}]});
    const result = await findOrCreateGoogleUser('google-new', 'new@b.com', 'New User');
    expect(result.oauth_id).toBe('google-new');
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('throws EmailCollisionError on unique constraint violation (23505)', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no oauth match
      .mockResolvedValueOnce({rows: []}) // no email match
      .mockRejectedValueOnce(Object.assign(new Error('unique_violation'), {code: '23505'}));
    await expect(findOrCreateGoogleUser('google-x', 'race@b.com', 'Test')).rejects.toThrow(
      EmailCollisionError
    );
  });

  it('re-throws non-23505 errors', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []})
      .mockResolvedValueOnce({rows: []})
      .mockRejectedValueOnce(Object.assign(new Error('connection error'), {code: 'ECONNREFUSED'}));
    await expect(findOrCreateGoogleUser('g', 'a@b.com', 'T')).rejects.toThrow('connection error');
  });
});

describe('getUserById', () => {
  it('returns row when found', async () => {
    pool.query.mockResolvedValueOnce({rows: [mockUserRow]});
    const result = await getUserById('u1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('u1');
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await getUserById('nonexistent');
    expect(result).toBeNull();
  });
});

describe('verifyPassword', () => {
  it('returns true when bcrypt.compare resolves true', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const result = await verifyPassword('correct-password', '$2b$12$hash');
    expect(result).toBe(true);
  });

  it('returns false when bcrypt.compare resolves false', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    const result = await verifyPassword('wrong-password', '$2b$12$hash');
    expect(result).toBe(false);
  });
});

describe('linkDfacId', () => {
  it('returns true when insert succeeds (rowCount > 0)', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 1});
    const result = await linkDfacId('u1', 'dfac-123');
    expect(result).toBe(true);
  });

  it('returns false when row already exists (ON CONFLICT DO NOTHING)', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 0});
    const result = await linkDfacId('u1', 'dfac-123');
    expect(result).toBe(false);
  });
});

describe('getDfacIdsForUser', () => {
  it('maps rows to array of dfac_id strings', async () => {
    pool.query.mockResolvedValueOnce({rows: [{dfac_id: 'dfac-1'}, {dfac_id: 'dfac-2'}]});
    const result = await getDfacIdsForUser('u1');
    expect(result).toEqual(['dfac-1', 'dfac-2']);
  });
});

describe('getUserIdByDfacId', () => {
  it('returns user_id when found', async () => {
    pool.query.mockResolvedValueOnce({rows: [{user_id: 'u1'}]});
    const result = await getUserIdByDfacId('dfac-123');
    expect(result).toBe('u1');
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await getUserIdByDfacId('dfac-nonexistent');
    expect(result).toBeNull();
  });
});

describe('getUserProfile', () => {
  it('returns profile with has_password: true when password_hash is set', async () => {
    pool.query.mockResolvedValueOnce({rows: [{...mockUserRow, password_hash: '$2b$hash', oauth_id: null}]});
    const result = await getUserProfile('u1');
    expect(result).not.toBeNull();
    expect(result!.has_password).toBe(true);
    expect(result!.has_google).toBe(false);
  });

  it('returns profile with has_google: true when oauth_id is set', async () => {
    pool.query.mockResolvedValueOnce({rows: [{...mockUserRow, password_hash: null, oauth_id: 'google-123'}]});
    const result = await getUserProfile('u1');
    expect(result).not.toBeNull();
    expect(result!.has_password).toBe(false);
    expect(result!.has_google).toBe(true);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await getUserProfile('nonexistent');
    expect(result).toBeNull();
  });
});

describe('updateEmail', () => {
  it('throws EmailCollisionError when email is already taken', async () => {
    pool.query.mockResolvedValueOnce({rows: [{id: 'other-user'}]});
    await expect(updateEmail('u1', 'taken@test.com')).rejects.toThrow(EmailCollisionError);
  });

  it('lowercases email and sets email_verified_at to NULL', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no collision
      .mockResolvedValueOnce({rows: []});
    await updateEmail('u1', 'New@Test.COM');
    const updateParams = pool.query.mock.calls[1][1] as any[];
    expect(updateParams[0]).toBe('new@test.com');
    const updateSql = pool.query.mock.calls[1][0] as string;
    expect(updateSql).toContain('email_verified_at = NULL');
  });
});

describe('setPasswordHash', () => {
  it('returns true when update succeeds (was previously null)', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 1});
    const result = await setPasswordHash('u1', '$2b$12$newhash');
    expect(result).toBe(true);
  });

  it('returns false when no rows updated (password already set)', async () => {
    pool.query.mockResolvedValueOnce({rowCount: 0});
    const result = await setPasswordHash('u1', '$2b$12$newhash');
    expect(result).toBe(false);
  });
});

describe('linkGoogleAccount', () => {
  it('throws EmailCollisionError when google ID is linked to another user', async () => {
    pool.query.mockResolvedValueOnce({rows: [{id: 'other-user'}]});
    await expect(linkGoogleAccount('u1', 'google-taken')).rejects.toThrow(EmailCollisionError);
  });

  it('updates oauth_id when no collision', async () => {
    pool.query
      .mockResolvedValueOnce({rows: []}) // no collision
      .mockResolvedValueOnce({rows: []});
    await linkGoogleAccount('u1', 'google-new');
    const updateSql = pool.query.mock.calls[1][0] as string;
    expect(updateSql).toContain('oauth_id');
    const updateParams = pool.query.mock.calls[1][1] as any[];
    expect(updateParams[0]).toBe('google-new');
  });
});

describe('softDeleteUser', () => {
  it('nulls email, password_hash, oauth_id and sets deleted_at', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await softDeleteUser('u1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('deleted_at = NOW()');
    expect(sql).toContain('email = NULL');
    expect(sql).toContain('password_hash = NULL');
    expect(sql).toContain('oauth_id = NULL');
  });
});

describe('markEmailVerified', () => {
  it('sets email_verified_at to NOW()', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await markEmailVerified('u1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('email_verified_at = NOW()');
  });
});

describe('isEmailVerified', () => {
  it('returns true when email_verified_at is set', async () => {
    pool.query.mockResolvedValueOnce({rows: [{email_verified_at: new Date()}]});
    const result = await isEmailVerified('u1');
    expect(result).toBe(true);
  });

  it('returns false when email_verified_at is null', async () => {
    pool.query.mockResolvedValueOnce({rows: [{email_verified_at: null}]});
    const result = await isEmailVerified('u1');
    expect(result).toBe(false);
  });

  it('returns false when user not found', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    const result = await isEmailVerified('nonexistent');
    expect(result).toBe(false);
  });
});

describe('updateProfileVisibility', () => {
  it('passes isPublic to the query', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await updateProfileVisibility('u1', false);
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe(false);
    expect(params[1]).toBe('u1');
  });
});

describe('updateDisplayName', () => {
  it('passes displayName and userId to the query', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await updateDisplayName('u1', 'New Name');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('New Name');
    expect(params[1]).toBe('u1');
  });
});

describe('updatePasswordHash', () => {
  it('passes new hash and userId to the query', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await updatePasswordHash('u1', '$2b$12$newhash');
    const params = pool.query.mock.calls[0][1] as any[];
    expect(params[0]).toBe('$2b$12$newhash');
    expect(params[1]).toBe('u1');
  });
});

describe('unlinkGoogleAccount', () => {
  it('sets oauth_id to NULL and auth_provider to local', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await unlinkGoogleAccount('u1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('oauth_id = NULL');
    expect(sql).toContain("auth_provider = 'local'");
  });
});
