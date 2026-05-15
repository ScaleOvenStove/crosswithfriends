import {pool, resetPoolMocks} from '../../__mocks__/pool';

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

import {
  addGameBan,
  clearModerationCache,
  getGameOwner,
  isGameLocked,
  isIdentityBanned,
  isOwner,
  lockGame,
  unlockGame,
} from '../../model/game_moderation';

beforeEach(() => {
  resetPoolMocks();
  clearModerationCache();
});

// Moderation state is loaded with 3 parallel queries: bans, locks, and the
// create event (for owner caching). Tests need to mock all three.
function mockState({
  bans = [],
  locked = false,
  creator = null,
}: {
  bans?: Array<{identity: string; identity_type: 'user' | 'dfac'}>;
  locked?: boolean;
  creator?: {userId?: string; dfacId?: string} | null;
}): void {
  pool.query.mockResolvedValueOnce({rows: bans});
  pool.query.mockResolvedValueOnce({rows: locked ? [{gid: 'g1'}] : []});
  pool.query.mockResolvedValueOnce({rows: creator ? [{event_payload: {params: {creator}}}] : []});
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
    // First call hit the DB (3 queries — bans, locks, create event), second
    // call should be cached (0 additional).
    expect(pool.query).toHaveBeenCalledTimes(3);
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
    // create event row present, no creator key
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: [{event_payload: {params: {pid: 'p1'}}}]});
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
