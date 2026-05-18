import {pool} from './pool';
import {TTLCache} from './ttl_cache';

export type Identity = {userId?: string | null; dfacId?: string | null};

export type GameCreator = {userId?: string; dfacId?: string};

export type RestrictableAction = 'check' | 'reveal' | 'reset';
export const RESTRICTABLE_ACTIONS: readonly RestrictableAction[] = ['check', 'reveal', 'reset'];

export type GameRestrictions = Record<RestrictableAction, boolean>;

function emptyRestrictions(): GameRestrictions {
  return {check: false, reveal: false, reset: false};
}

// Per-gid cache so the socket fast-path doesn't hit Postgres on every event.
// Bans, locks, restrictions, and ownership change rarely; 5 minutes is
// generous but bounded. Invalidated explicitly on ban/lock/restriction
// writes. Ownership itself is immutable but we still recompute it on
// cache miss for code simplicity — the create event lookup is a single
// PK probe.
type ModerationState = {
  banned: {userIds: Set<string>; dfacIds: Set<string>};
  locked: boolean;
  restrictions: GameRestrictions;
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
  const [bans, locks, restrictionRows, creator] = await Promise.all([
    pool.query<{identity: string; identity_type: 'user' | 'dfac'}>(
      `SELECT identity, identity_type FROM game_bans WHERE gid = $1`,
      [gid]
    ),
    pool.query<{gid: string}>(`SELECT gid FROM game_locks WHERE gid = $1`, [gid]),
    pool.query<{action: RestrictableAction}>(`SELECT action FROM game_restrictions WHERE gid = $1`, [gid]),
    // Extract just the creator subtree from the create event's payload.
    // Pulling the full event_payload would drag the whole bootstrap blob
    // (grid + clues + solution) across the wire for every cache miss; the
    // creator is the only field we actually use.
    pool.query<{creator: {userId?: string; dfacId?: string} | null}>(
      `SELECT event_payload->'params'->'creator' AS creator
       FROM game_events
       WHERE gid = $1 AND event_type = 'create'
       ORDER BY ts ASC
       LIMIT 1`,
      [gid]
    ),
  ]);
  const userIds = new Set<string>();
  const dfacIds = new Set<string>();
  for (const row of bans.rows) {
    if (row.identity_type === 'user') userIds.add(row.identity);
    else dfacIds.add(row.identity);
  }
  const restrictions = emptyRestrictions();
  for (const row of restrictionRows.rows) {
    // CHECK constraint at the DB layer guarantees row.action is one of
    // the three; the type assertion keeps the loop terse.
    restrictions[row.action] = true;
  }
  let owner: GameCreator | null = null;
  const creatorPayload = creator.rows[0]?.creator;
  if (creatorPayload) {
    owner = {};
    if (creatorPayload.userId) owner.userId = creatorPayload.userId;
    if (creatorPayload.dfacId) owner.dfacId = creatorPayload.dfacId;
    if (Object.keys(owner).length === 0) owner = null;
  }
  return {banned: {userIds, dfacIds}, locked: locks.rows.length > 0, restrictions, owner};
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

// Prior participants get an owner-equivalent bypass on the lock gate
// so they survive transient reconnects: the moderation contract is
// "lock blocks new joins; existing players keep playing". Without this,
// any mobile/flaky reconnect would re-issue join_game on a locked game
// and the client would treat the rejection as terminal.
//
// We define "participant" as having any persisted event for this gid.
// We deliberately do NOT compare to locked_at: game_events.ts is the
// client-supplied event.timestamp (client clock), while locked_at is
// server NOW(). Even small clock skew (machine slightly ahead of the
// server) would push a legitimate pre-lock event's ts past locked_at
// and the bypass would fail. Lock is moderation, not security — being
// permissive here doesn't materially weaken anything, and it eliminates
// a confusing "I can play but refresh kicks me out" failure mode.
export async function wasParticipantOfGame(gid: string, identity: Identity): Promise<boolean> {
  if (!identity.userId && !identity.dfacId) return false;
  if (identity.dfacId) {
    const r = await pool.query(`SELECT 1 FROM game_events WHERE gid = $1 AND uid = $2 LIMIT 1`, [
      gid,
      identity.dfacId,
    ]);
    if (r.rows.length > 0) return true;
  }
  if (identity.userId) {
    // verifiedUserId is server-stamped on every persisted event from
    // authenticated sockets, so a logged-in user with a different local
    // dfac id on reconnect still gets recognized as a prior participant.
    const r = await pool.query(
      `SELECT 1 FROM game_events
       WHERE gid = $1
         AND (event_payload->>'verifiedUserId') = $2
       LIMIT 1`,
      [gid, identity.userId]
    );
    if (r.rows.length > 0) return true;
  }
  return false;
}

// Public list of kicked dfac_ids for a gid — used client-side to grey out
// kicked players who left grid/chat history behind. User-id bans are kept
// private since they identify accounts; dfac_ids are already broadcast on
// kick and visible to every client in the room.
export async function getKickedDfacIds(gid: string): Promise<string[]> {
  const state = await getModerationState(gid);
  return Array.from(state.banned.dfacIds);
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

// Lift a ban — owner reversed a kick. Removes both the dfac and user
// rows so the target's other devices (linked via user_identity_map) also
// regain access. Caller is expected to supply both identities when known.
export async function removeGameBan(
  gid: string,
  target: {dfacId?: string | null; userId?: string | null}
): Promise<void> {
  const removals: Promise<unknown>[] = [];
  if (target.dfacId) {
    removals.push(
      pool.query(`DELETE FROM game_bans WHERE gid = $1 AND identity = $2 AND identity_type = 'dfac'`, [
        gid,
        target.dfacId,
      ])
    );
  }
  if (target.userId) {
    removals.push(
      pool.query(`DELETE FROM game_bans WHERE gid = $1 AND identity = $2 AND identity_type = 'user'`, [
        gid,
        target.userId,
      ])
    );
  }
  await Promise.all(removals);
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

// Restrictions: presence row per (gid, action) = the action is owner-only.
// Setters mirror the lock pattern — INSERT to enable, DELETE to clear.

export async function getGameRestrictions(gid: string): Promise<GameRestrictions> {
  const state = await getModerationState(gid);
  // Defensive copy so callers can't mutate the cached state.
  return {...state.restrictions};
}

// Fast-path used by the socket layer on every check/reveal/reset event.
// Reads from the same cached moderation state as everything else.
export async function isActionRestricted(gid: string, action: RestrictableAction): Promise<boolean> {
  const state = await getModerationState(gid);
  return state.restrictions[action];
}

export async function setGameRestriction(
  gid: string,
  action: RestrictableAction,
  by: Identity
): Promise<void> {
  await pool.query(
    `INSERT INTO game_restrictions (gid, action, restricted_by_user_id, restricted_by_dfac_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (gid, action) DO NOTHING`,
    [gid, action, by.userId || null, by.dfacId || null]
  );
  invalidateModerationCacheForGid(gid);
}

export async function clearGameRestriction(gid: string, action: RestrictableAction): Promise<void> {
  await pool.query(`DELETE FROM game_restrictions WHERE gid = $1 AND action = $2`, [gid, action]);
  invalidateModerationCacheForGid(gid);
}
