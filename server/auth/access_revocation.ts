// Access tokens are stateless JWTs with a short TTL, so revoking a user's
// refresh tokens (password change/reset, account deletion, refresh-token
// reuse) does not on its own stop the access tokens already handed out:
// they keep working until they expire. This module closes that window by
// remembering, per user, the moment their tokens were revoked; any access
// token issued before that moment is rejected.
//
// An entry only needs to outlive the longest-lived token it could reject,
// so entries older than the access-token TTL are pruned.
//
// The list lives in process memory. That matches the backend's current
// single-instance deployment (the moderation cache makes the same
// assumption). Running more than one instance would need a shared store.

// Lifetime of an access token. jwt.ts signs with this, so an entry here is
// never pruned while a token it could reject is still unexpired.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// userId → revocation time, in whole seconds since the epoch (JWT `iat`
// granularity).
const revokedAt = new Map<string, number>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function prune(now: number): void {
  for (const [userId, at] of revokedAt) {
    if (now - at > ACCESS_TOKEN_TTL_SECONDS) revokedAt.delete(userId);
  }
}

export function revokeAccessTokensForUser(userId: string): void {
  const now = nowSeconds();
  prune(now);
  revokedAt.set(userId, now);
}

// A token issued in the same second as the revocation is kept: the routes
// that revoke (change-password) issue the caller's replacement token in
// that same second, and `iat` cannot tell the two apart.
export function isAccessTokenRevoked(userId: string, issuedAt: number | undefined): boolean {
  const at = revokedAt.get(userId);
  if (at === undefined) return false;
  if (issuedAt === undefined) return true;
  return issuedAt < at;
}

export function resetAccessRevocationsForTests(): void {
  revokedAt.clear();
}
