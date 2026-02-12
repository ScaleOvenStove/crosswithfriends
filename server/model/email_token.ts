import crypto from 'crypto';
import {pool} from './pool';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ======================== Email Verification Tokens ========================

const VERIFICATION_EXPIRY_HOURS = 24;

export async function createVerificationToken(userId: string, newEmail?: string): Promise<string> {
  // Invalidate any existing unused tokens for this user
  await pool.query(
    `UPDATE email_verification_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, new_email, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, newEmail || null, expiresAt.toISOString()]
  );

  return rawToken;
}

export async function validateVerificationToken(
  token: string
): Promise<{userId: string; newEmail: string | null} | null> {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `SELECT user_id, new_email, expires_at, used_at
     FROM email_verification_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  // Mark as used
  await pool.query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE token_hash = $1`, [tokenHash]);

  return {userId: row.user_id, newEmail: row.new_email};
}

/**
 * Check if the user's most recent token was created less than `seconds` ago.
 * Used for rate-limiting resend requests.
 */
export async function wasVerificationTokenRecentlyCreated(userId: string, seconds = 60): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM email_verification_tokens
     WHERE user_id = $1 AND created_at > NOW() - ($2 || ' seconds')::interval
     LIMIT 1`,
    [userId, String(seconds)]
  );
  return res.rows.length > 0;
}

// ======================== Password Reset Tokens ========================

const RESET_EXPIRY_HOURS = 1;

export async function createPasswordResetToken(userId: string): Promise<string> {
  // Invalidate any existing unused tokens for this user
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return rawToken;
}

export async function validatePasswordResetToken(token: string): Promise<{userId: string} | null> {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `SELECT user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  // Mark as used
  await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1`, [tokenHash]);

  return {userId: row.user_id};
}

// ======================== Cleanup ========================

export async function cleanupExpiredEmailTokens(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM email_verification_tokens
     WHERE expires_at < NOW()
        OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')`
  );
  return res.rowCount ?? 0;
}

export async function cleanupExpiredResetTokens(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM password_reset_tokens
     WHERE expires_at < NOW()
        OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day')`
  );
  return res.rowCount ?? 0;
}
