import bcrypt from 'bcrypt';
import {pool} from './pool';

const BCRYPT_ROUNDS = 12;

export class EmailCollisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailCollisionError';
  }
}

export interface UserRow {
  id: string;
  email: string | null;
  password_hash?: string | null;
  display_name: string | null;
  auth_provider: string;
  oauth_id: string | null;
  created_at: Date;
  updated_at: Date;
  email_verified_at?: Date | null;
  profile_is_public: boolean;
}

export interface UserProfile extends UserRow {
  has_password: boolean;
  has_google: boolean;
}

export async function createLocalUser(
  email: string,
  password: string,
  displayName: string
): Promise<UserRow> {
  const startTime = Date.now();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const res = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, auth_provider)
     VALUES ($1, $2, $3, 'local')
     RETURNING id, email, password_hash, display_name, auth_provider, oauth_id, created_at, updated_at, email_verified_at, profile_is_public`,
    [email.toLowerCase(), passwordHash, displayName]
  );
  const ms = Date.now() - startTime;
  console.log(`createLocalUser(${email}) took ${ms}ms`);
  return res.rows[0];
}

export async function findUserByEmail(email: string): Promise<(UserRow & {password_hash: string}) | null> {
  const res = await pool.query(
    `SELECT id, email, password_hash, display_name, auth_provider, oauth_id, created_at, updated_at, email_verified_at, profile_is_public
     FROM users
     WHERE email = $1 AND deleted_at IS NULL`,
    [email.toLowerCase()]
  );
  return res.rows[0] || null;
}

export async function findOrCreateGoogleUser(
  googleId: string,
  email: string,
  displayName: string
): Promise<UserRow> {
  const startTime = Date.now();
  const lowerEmail = email.toLowerCase();

  // Check if a user already has this Google oauth_id linked (any auth_provider)
  const byOauth = await pool.query(
    `SELECT id, email, password_hash, display_name, auth_provider, oauth_id, created_at, updated_at, email_verified_at, profile_is_public
     FROM users
     WHERE oauth_id = $1 AND deleted_at IS NULL`,
    [googleId]
  );

  if (byOauth.rows[0]) {
    const ms = Date.now() - startTime;
    console.log(`findOrCreateGoogleUser(${googleId}) found by oauth_id, took ${ms}ms`);
    return byOauth.rows[0];
  }

  // Check if the email is already taken by another account
  const byEmail = await pool.query(
    `SELECT id, auth_provider FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [lowerEmail]
  );

  if (byEmail.rows[0]) {
    throw new EmailCollisionError(
      'An account with this email already exists. Log in with email/password, then link Google from your profile.'
    );
  }

  // Create new Google user (auto-verified since Google confirmed ownership)
  try {
    const res = await pool.query(
      `INSERT INTO users (email, display_name, auth_provider, oauth_id, email_verified_at)
       VALUES ($1, $2, 'google', $3, NOW())
       ON CONFLICT (auth_provider, oauth_id) WHERE oauth_id IS NOT NULL
       DO UPDATE SET updated_at = NOW()
       RETURNING id, email, password_hash, display_name, auth_provider, oauth_id, created_at, updated_at, email_verified_at, profile_is_public`,
      [lowerEmail, displayName, googleId]
    );
    const ms = Date.now() - startTime;
    console.log(`findOrCreateGoogleUser(${googleId}) created new, took ${ms}ms`);
    return res.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new EmailCollisionError(
        'An account with this email already exists. Log in with email/password, then link Google from your profile.'
      );
    }
    throw err;
  }
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const res = await pool.query(
    `SELECT id, email, display_name, auth_provider, oauth_id, created_at, updated_at, profile_is_public
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return res.rows[0] || null;
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function linkDfacId(userId: string, dfacId: string): Promise<boolean> {
  const startTime = Date.now();
  const result = await pool.query(
    `INSERT INTO user_identity_map (user_id, dfac_id)
     VALUES ($1, $2)
     ON CONFLICT (dfac_id) DO NOTHING`,
    [userId, dfacId]
  );
  const isNew = (result.rowCount || 0) > 0;
  const ms = Date.now() - startTime;
  console.log(`linkDfacId(${userId}, ${dfacId}) ${isNew ? 'NEW' : 'already linked'} in ${ms}ms`);
  return isNew;
}

export async function getDfacIdsForUser(userId: string): Promise<string[]> {
  const res = await pool.query(`SELECT dfac_id FROM user_identity_map WHERE user_id = $1`, [userId]);
  return res.rows.map((r: {dfac_id: string}) => r.dfac_id);
}

export async function getUserIdByDfacId(dfacId: string): Promise<string | null> {
  const res = await pool.query(`SELECT user_id FROM user_identity_map WHERE dfac_id = $1`, [dfacId]);
  return res.rows[0]?.user_id || null;
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const res = await pool.query(
    `SELECT id, email, password_hash, display_name, auth_provider, oauth_id, created_at, updated_at, email_verified_at, profile_is_public
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    has_password: !!row.password_hash,
    has_google: !!row.oauth_id,
  };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  await pool.query(`UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2`, [
    displayName,
    userId,
  ]);
}

export async function updateEmail(userId: string, newEmail: string): Promise<void> {
  const lowerEmail = newEmail.toLowerCase();
  // Check if email is taken
  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL`,
    [lowerEmail, userId]
  );
  if (existing.rows[0]) {
    throw new EmailCollisionError('This email is already in use by another account');
  }
  await pool.query(
    `UPDATE users SET email = $1, email_verified_at = NULL, updated_at = NOW() WHERE id = $2`,
    [lowerEmail, userId]
  );
}

export async function updatePasswordHash(userId: string, newHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    newHash,
    userId,
  ]);
}

export async function setPasswordHash(userId: string, hash: string): Promise<boolean> {
  const res = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE id = $2 AND password_hash IS NULL
     RETURNING id`,
    [hash, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function linkGoogleAccount(userId: string, googleId: string): Promise<void> {
  // Check no other user already has this Google ID
  const existing = await pool.query(
    `SELECT id FROM users WHERE oauth_id = $1 AND id != $2 AND deleted_at IS NULL`,
    [googleId, userId]
  );
  if (existing.rows[0]) {
    throw new EmailCollisionError('This Google account is already linked to another user');
  }
  await pool.query(`UPDATE users SET oauth_id = $1, updated_at = NOW() WHERE id = $2`, [googleId, userId]);
}

export async function unlinkGoogleAccount(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET oauth_id = NULL, auth_provider = 'local', updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function softDeleteUser(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET deleted_at = NOW(), email = NULL, password_hash = NULL, oauth_id = NULL, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
}

export async function markEmailVerified(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const res = await pool.query(`SELECT email_verified_at FROM users WHERE id = $1 AND deleted_at IS NULL`, [
    userId,
  ]);
  return !!res.rows[0]?.email_verified_at;
}

export async function updateProfileVisibility(userId: string, isPublic: boolean): Promise<void> {
  await pool.query(`UPDATE users SET profile_is_public = $1, updated_at = NOW() WHERE id = $2`, [
    isPublic,
    userId,
  ]);
}
