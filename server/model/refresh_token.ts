import crypto from 'crypto';
import {pool} from './pool';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(userId: string, expiresInDays = 7): Promise<string> {
  const startTime = Date.now();
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  const ms = Date.now() - startTime;
  console.log(`createRefreshToken(${userId}) took ${ms}ms`);
  return rawToken;
}

export async function validateRefreshToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `SELECT user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const row = res.rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return row.user_id;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [
    userId,
  ]);
}

/**
 * Delete tokens that are expired or were revoked more than 1 day ago.
 * Called periodically to prevent table bloat from token rotation.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const res = await pool.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW()
        OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '1 day')`
  );
  return res.rowCount ?? 0;
}
