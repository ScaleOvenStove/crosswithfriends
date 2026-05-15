import {pool} from './pool';
import {TTLCache} from './ttl_cache';

export type Identity = {userId?: string | null; dfacId?: string | null};

export type GameCreator = {userId?: string; dfacId?: string};

// Per-gid cache so the socket fast-path doesn't hit Postgres on every event.
// Bans, locks, and ownership change rarely; 5 minutes is generous but
// bounded. Invalidated explicitly on ban/lock/unlock writes. Ownership
// itself is immutable but we still recompute it on cache miss for code
// simplicity — the create event lookup is a single PK probe.
type ModerationState = {
  banned: {userIds: Set<string>; dfacIds: Set<string>};
  locked: boolean;
  owner: GameCreator | null;
};
const moderationCache = new TTLCache<ModerationState>({ttlMs: 5 * 60_000, maxSize: 10_000});

export function invalidateModerationCacheForGid(gid: string): void {
  moderationCache.delete(gid);
}

export function clearModerationCache(): void {
  moderationCache.clear();
}

async function loadModerationState(gid: string): Promise<ModerationState> {
  const [bans, locks, creator] = await Promise.all([
    pool.query<{identity: string; identity_type: 'user' | 'dfac'}>(
      `SELECT identity, identity_type FROM game_bans WHERE gid = $1`,
      [gid]
    ),
    pool.query<{gid: string}>(`SELECT gid FROM game_locks WHERE gid = $1`, [gid]),
    pool.query<{event_payload: any}>(
      `SELECT event_payload FROM game_events WHERE gid = $1 AND event_type = 'create' ORDER BY ts ASC LIMIT 1`,
      [gid]
    ),
  ]);
  const userIds = new Set<string>();
  const dfacIds = new Set<string>();
  for (const row of bans.rows) {
    if (row.identity_type === 'user') userIds.add(row.identity);
    else dfacIds.add(row.identity);
  }
  let owner: GameCreator | null = null;
  const creatorPayload = creator.rows[0]?.event_payload?.params?.creator;
  if (creatorPayload) {
    owner = {};
    if (creatorPayload.userId) owner.userId = creatorPayload.userId;
    if (creatorPayload.dfacId) owner.dfacId = creatorPayload.dfacId;
    if (Object.keys(owner).length === 0) owner = null;
  }
  return {banned: {userIds, dfacIds}, locked: locks.rows.length > 0, owner};
}

async function getModerationState(gid: string): Promise<ModerationState> {
  return moderationCache.getOrFetch(gid, () => loadModerationState(gid));
}

// True if either of the caller's identities is banned for this gid. The
// socket layer calls this on every join + every persisted event, so the
// cache matters here.
export async function isIdentityBanned(gid: string, identity: Identity): Promise<boolean> {
  // No identity → nothing to match against, skip the DB hit. This keeps the
  // socket layer's per-event overhead at zero for unauthenticated callers
  // whose client doesn't send a dfac_id either (legacy clients, tests).
  if (!identity.userId && !identity.dfacId) return false;
  const state = await getModerationState(gid);
  if (identity.userId && state.banned.userIds.has(identity.userId)) return true;
  if (identity.dfacId && state.banned.dfacIds.has(identity.dfacId)) return true;
  return false;
}

export async function isGameLocked(gid: string): Promise<boolean> {
  const state = await getModerationState(gid);
  return state.locked;
}

// Owner identity is stamped onto the create event's params.creator at game
// creation time. Games created before this feature have no creator → no
// one can moderate them (returns null).
export async function getGameOwner(gid: string): Promise<GameCreator | null> {
  const state = await getModerationState(gid);
  return state.owner;
}

export function isOwner(
  owner: GameCreator | null,
  caller: {userId?: string | null; dfacIds?: string[]}
): boolean {
  if (!owner) return false;
  if (owner.userId && caller.userId && owner.userId === caller.userId) return true;
  if (owner.dfacId && caller.dfacIds && caller.dfacIds.includes(owner.dfacId)) return true;
  return false;
}

export async function addGameBan(
  gid: string,
  target: {identity: string; identityType: 'user' | 'dfac'},
  bannedByUserId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO game_bans (gid, identity, identity_type, banned_by_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (gid, identity, identity_type) DO NOTHING`,
    [gid, target.identity, target.identityType, bannedByUserId]
  );
  invalidateModerationCacheForGid(gid);
}

export async function lockGame(gid: string, by: Identity): Promise<void> {
  await pool.query(
    `INSERT INTO game_locks (gid, locked_by_user_id, locked_by_dfac_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (gid) DO NOTHING`,
    [gid, by.userId || null, by.dfacId || null]
  );
  invalidateModerationCacheForGid(gid);
}

export async function unlockGame(gid: string): Promise<void> {
  await pool.query(`DELETE FROM game_locks WHERE gid = $1`, [gid]);
  invalidateModerationCacheForGid(gid);
}
