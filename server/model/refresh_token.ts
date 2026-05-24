import crypto from 'crypto';
import {pool} from './pool';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(userId: string, expiresInDays = 7): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return rawToken;
}

// Grace window for treating a just-revoked token as a benign concurrent
// rotation rather than reuse/theft. Two near-simultaneous /refresh calls with
// the same cookie (tab restore, parallel 401 retries) are common: the loser of
// the FOR UPDATE race sees the row already revoked. We don't want that to nuke
// every session, so reuse of a token revoked within this window is simply
// rejected. Reuse beyond it indicates a leaked token being replayed.
const REUSE_GRACE_MS = 10_000;

export type RotateRefreshResult =
  | {status: 'invalid'} // token not found or expired — the cookie is dead
  | {status: 'retry'} // lost a benign concurrent rotation race — cookie is still valid
  | {status: 'reuse'; userId: string} // replay of a rotated token — family revoked
  | {status: 'rotated'; userId: string; token: string};

// Atomically rotate a refresh token: validate, revoke the old token, and mint
// a replacement in a single serialized transaction (SELECT ... FOR UPDATE).
// This closes three issues with the previous validate-then-revoke-then-create
// sequence: a crash between revoke and create no longer logs the user out;
// concurrent refreshes with the same token can't both mint new tokens; and
// reuse of an already-rotated token is detected and revokes the whole family.
export async function rotateRefreshToken(token: string, expiresInDays = 7): Promise<RotateRefreshResult> {
  const tokenHash = hashToken(token);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );
    const row = res.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return {status: 'invalid'};
    }
    if (row.revoked_at) {
      const revokedMsAgo = Date.now() - new Date(row.revoked_at).getTime();
      if (revokedMsAgo > REUSE_GRACE_MS) {
        // Replay of a token rotated long ago → treat as compromise and revoke
        // every active token for the user, forcing a fresh login.
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [row.user_id]
        );
        await client.query('COMMIT');
        return {status: 'reuse', userId: row.user_id};
      }
      // Benign concurrent rotation — a parallel /refresh already rotated this
      // token and issued a fresh cookie. Signal 'retry' so the caller leaves
      // that new cookie intact instead of clearing it.
      await client.query('ROLLBACK');
      return {status: 'retry'};
    }
    if (new Date(row.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return {status: 'invalid'};
    }

    await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
    const rawToken = crypto.randomBytes(48).toString('hex');
    const newHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await client.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [
      row.user_id,
      newHash,
      expiresAt.toISOString(),
    ]);
    await client.query('COMMIT');
    return {status: 'rotated', userId: row.user_id, token: rawToken};
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
