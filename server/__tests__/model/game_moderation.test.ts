import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  addGameBan,
  clearGameRestriction,
  clearModerationCache,
  getGameOwner,
  getGameRestrictions,
  isActionRestricted,
  isGameLocked,
  isIdentityBanned,
  isOwner,
  lockGame,
  RestrictableAction,
  setGameRestriction,
  unlockGame,
  wasParticipantOfGame,
} from '../../model/game_moderation';

beforeEach(() => {
  resetPoolMocks();
  clearModerationCache();
});

// Moderation state is loaded with 4 parallel queries: bans, locks,
// restrictions, and the create event (for owner caching). Tests need to
// mock all four.
function mockState({
  bans = [],
  locked = false,
  restrictions = [],
  creator = null,
}: {
  bans?: Array<{identity: string; identity_type: 'user' | 'dfac'}>;
  locked?: boolean;
  restrictions?: RestrictableAction[];
  creator?: {userId?: string; dfacId?: string} | null;
}): void {
  pool.query.mockResolvedValueOnce({rows: bans});
  pool.query.mockResolvedValueOnce({rows: locked ? [{gid: 'g1'}] : []});
  pool.query.mockResolvedValueOnce({rows: restrictions.map((action) => ({action}))});
  // The moderation loader extracts event_payload->'params'->'creator' as
  // `creator` directly in SQL, so the mocked row matches that shape.
  pool.query.mockResolvedValueOnce({rows: creator ? [{creator}] : []});
}

describe('isIdentityBanned', () => {
  it('returns true when the user_id matches a ban row', async () => {
    mockState({bans: [{identity: 'user-1', identity_type: 'user'}]});
    expect(await isIdentityBanned('g1', {userId: 'user-1'})).toBe(true);
  });

  it('returns true when the dfac_id matches', async () => {
    mockState({bans: [{identity: 'dfac-x', identity_type: 'dfac'}]});
    expect(await isIdentityBanned('g1', {dfacId: 'dfac-x'})).toBe(true);
  });

  it('returns false when neither identity matches', async () => {
    mockState({bans: [{identity: 'other', identity_type: 'user'}]});
    expect(await isIdentityBanned('g1', {userId: 'user-1', dfacId: 'dfac-x'})).toBe(false);
  });

  it('caches per-gid so back-to-back socket events skip the DB', async () => {
    mockState({});
    await isIdentityBanned('g1', {userId: 'user-1'});
    await isIdentityBanned('g1', {userId: 'user-2'});
    // First call hit the DB (4 queries — bans, locks, restrictions, create
    // event), second call should be cached (0 additional).
    expect(pool.query).toHaveBeenCalledTimes(4);
  });
});

describe('isGameLocked', () => {
  it('returns true when a game_locks row exists', async () => {
    mockState({locked: true});
    expect(await isGameLocked('g1')).toBe(true);
  });

  it('returns false when no row exists', async () => {
    mockState({locked: false});
    expect(await isGameLocked('g1')).toBe(false);
  });
});

describe('getGameOwner', () => {
  it('reads creator from the create event payload', async () => {
    mockState({creator: {userId: 'user-1', dfacId: 'dfac-x'}});
    expect(await getGameOwner('g1')).toEqual({userId: 'user-1', dfacId: 'dfac-x'});
  });

  it('returns null when no create event exists', async () => {
    mockState({});
    expect(await getGameOwner('g1')).toBeNull();
  });

  it('returns null when create event has no creator field (legacy game)', async () => {
    // create event row present, JSON path returns NULL for missing creator.
    pool.query.mockResolvedValueOnce({rows: []}); // bans
    pool.query.mockResolvedValueOnce({rows: []}); // locks
    pool.query.mockResolvedValueOnce({rows: []}); // restrictions
    pool.query.mockResolvedValueOnce({rows: [{creator: null}]}); // create event
    expect(await getGameOwner('g1')).toBeNull();
  });
});

describe('isOwner', () => {
  it('matches on user_id', () => {
    expect(isOwner({userId: 'u1'}, {userId: 'u1', dfacIds: []})).toBe(true);
  });

  it('matches on any dfac_id in the caller list', () => {
    expect(isOwner({dfacId: 'd2'}, {userId: 'u1', dfacIds: ['d1', 'd2']})).toBe(true);
  });

  it('returns false on mismatch', () => {
    expect(isOwner({userId: 'u1'}, {userId: 'u2', dfacIds: ['d1']})).toBe(false);
  });

  it('returns false when owner is null (legacy game)', () => {
    expect(isOwner(null, {userId: 'u1', dfacIds: ['d1']})).toBe(false);
  });
});

describe('wasParticipantOfGame', () => {
  it('returns true when a game_events row exists for the dfac_id', async () => {
    pool.query.mockResolvedValueOnce({rows: [{exists: 1}]});
    expect(await wasParticipantOfGame('g1', {dfacId: 'dfac-x'})).toBe(true);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('FROM game_events');
    expect(sql).toContain('uid = $2');
    expect(params).toEqual(['g1', 'dfac-x']);
  });

  it('returns true when a verifiedUserId matches (cross-device reconnect)', async () => {
    pool.query.mockResolvedValueOnce({rows: []}); // no dfac match
    pool.query.mockResolvedValueOnce({rows: [{exists: 1}]}); // userId match
    expect(await wasParticipantOfGame('g1', {userId: 'u1', dfacId: 'new-dfac'})).toBe(true);
    expect(pool.query.mock.calls[1][0]).toContain("event_payload->>'verifiedUserId'");
  });

  it('returns false when neither identity has any events', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await wasParticipantOfGame('g1', {userId: 'u1', dfacId: 'd1'})).toBe(false);
  });

  it('returns false and skips the DB when identity is empty', async () => {
    expect(await wasParticipantOfGame('g1', {})).toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does not constrain on timestamp (deliberate)', async () => {
    // The temporal check was removed because event.timestamp is the
    // client's clock; any forward skew would push legitimate pre-lock
    // events past locked_at and break the bypass on refresh.
    pool.query.mockResolvedValueOnce({rows: [{exists: 1}]});
    await wasParticipantOfGame('g1', {dfacId: 'd1'});
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('ts <');
    expect(sql).not.toContain('locked_at');
  });
});

describe('addGameBan / lockGame / unlockGame', () => {
  it('addGameBan upserts and invalidates cache', async () => {
    // Prime cache
    mockState({});
    await isIdentityBanned('g1', {userId: 'u1'});

    // Add ban
    pool.query.mockResolvedValueOnce({rows: []});
    await addGameBan('g1', {identity: 'u1', identityType: 'user'}, 'admin');
    const insertSql = pool.query.mock.calls[pool.query.mock.calls.length - 1][0] as string;
    expect(insertSql).toContain('INSERT INTO game_bans');
    expect(insertSql).toContain('ON CONFLICT (gid, identity, identity_type) DO NOTHING');

    // Next isIdentityBanned hits DB again (cache busted) and now sees the row
    mockState({bans: [{identity: 'u1', identity_type: 'user'}]});
    expect(await isIdentityBanned('g1', {userId: 'u1'})).toBe(true);
  });

  it('lockGame inserts a game_locks row', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await lockGame('g1', {userId: 'u1', dfacId: 'd1'});
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO game_locks');
    expect(sql).toContain('ON CONFLICT (gid) DO NOTHING');
  });

  it('unlockGame deletes the row', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    await unlockGame('g1');
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM game_locks');
  });
});

describe('game restrictions', () => {
  it('isActionRestricted returns true when a row exists for the action', async () => {
    mockState({restrictions: ['reveal']});
    expect(await isActionRestricted('g1', 'reveal')).toBe(true);
    expect(await isActionRestricted('g1', 'check')).toBe(false);
    expect(await isActionRestricted('g1', 'reset')).toBe(false);
  });

  it('isActionRestricted defaults to false when no restrictions are set', async () => {
    mockState({});
    expect(await isActionRestricted('g1', 'check')).toBe(false);
    expect(await isActionRestricted('g1', 'reveal')).toBe(false);
    expect(await isActionRestricted('g1', 'reset')).toBe(false);
  });

  it('getGameRestrictions returns the full action map', async () => {
    mockState({restrictions: ['check', 'reset']});
    expect(await getGameRestrictions('g1')).toEqual({check: true, reveal: false, reset: true});
  });

  it('getGameRestrictions returns a defensive copy so callers cannot mutate the cache', async () => {
    mockState({restrictions: ['reveal']});
    const first = await getGameRestrictions('g1');
    first.reveal = false;
    // Second call hits the cache; should still report the original state.
    const second = await getGameRestrictions('g1');
    expect(second.reveal).toBe(true);
  });

  it('setGameRestriction upserts and invalidates cache', async () => {
    // Prime cache with no restrictions
    mockState({});
    expect(await isActionRestricted('g1', 'reveal')).toBe(false);

    pool.query.mockResolvedValueOnce({rows: []});
    await setGameRestriction('g1', 'reveal', {userId: 'u1', dfacId: 'd1'});
    const insertSql = pool.query.mock.calls[pool.query.mock.calls.length - 1][0] as string;
    expect(insertSql).toContain('INSERT INTO game_restrictions');
    expect(insertSql).toContain('ON CONFLICT (gid, action) DO NOTHING');

    // Next read hits the DB again and now sees the row.
    mockState({restrictions: ['reveal']});
    expect(await isActionRestricted('g1', 'reveal')).toBe(true);
  });

  it('clearGameRestriction deletes the row and invalidates cache', async () => {
    // Prime cache with reveal restricted
    mockState({restrictions: ['reveal']});
    expect(await isActionRestricted('g1', 'reveal')).toBe(true);

    pool.query.mockResolvedValueOnce({rows: []});
    await clearGameRestriction('g1', 'reveal');
    const sql = pool.query.mock.calls[pool.query.mock.calls.length - 1][0] as string;
    expect(sql).toContain('DELETE FROM game_restrictions');
    expect(sql).toContain('action = $2');

    // Next read hits the DB again with no rows; restriction is gone.
    mockState({});
    expect(await isActionRestricted('g1', 'reveal')).toBe(false);
  });
});
