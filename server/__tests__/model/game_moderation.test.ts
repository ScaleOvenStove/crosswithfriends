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

describe('isIdentityBanned', () => {
  it('returns true when the user_id matches a ban row', async () => {
    // game_bans + game_locks lookup happens in parallel
    pool.query.mockResolvedValueOnce({rows: [{identity: 'user-1', identity_type: 'user'}]});
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await isIdentityBanned('g1', {userId: 'user-1'})).toBe(true);
  });

  it('returns true when the dfac_id matches', async () => {
    pool.query.mockResolvedValueOnce({rows: [{identity: 'dfac-x', identity_type: 'dfac'}]});
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await isIdentityBanned('g1', {dfacId: 'dfac-x'})).toBe(true);
  });

  it('returns false when neither identity matches', async () => {
    pool.query.mockResolvedValueOnce({rows: [{identity: 'other', identity_type: 'user'}]});
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await isIdentityBanned('g1', {userId: 'user-1', dfacId: 'dfac-x'})).toBe(false);
  });

  it('caches per-gid so back-to-back socket events skip the DB', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: []});
    await isIdentityBanned('g1', {userId: 'user-1'});
    await isIdentityBanned('g1', {userId: 'user-2'});
    // First call hit the DB (2 queries), second call should be cached (0).
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});

describe('isGameLocked', () => {
  it('returns true when a game_locks row exists', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: [{gid: 'g1'}]});
    expect(await isGameLocked('g1')).toBe(true);
  });

  it('returns false when no row exists', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await isGameLocked('g1')).toBe(false);
  });
});

describe('getGameOwner', () => {
  it('reads creator from the create event payload', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{event_payload: {params: {creator: {userId: 'user-1', dfacId: 'dfac-x'}}}}],
    });
    expect(await getGameOwner('g1')).toEqual({userId: 'user-1', dfacId: 'dfac-x'});
  });

  it('returns null when no create event exists', async () => {
    pool.query.mockResolvedValueOnce({rows: []});
    expect(await getGameOwner('g1')).toBeNull();
  });

  it('returns null when create event has no creator field (legacy game)', async () => {
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
    pool.query.mockResolvedValueOnce({rows: []});
    pool.query.mockResolvedValueOnce({rows: []});
    await isIdentityBanned('g1', {userId: 'u1'});

    // Add ban
    pool.query.mockResolvedValueOnce({rows: []});
    await addGameBan('g1', {identity: 'u1', identityType: 'user'}, 'admin');
    const insertSql = pool.query.mock.calls[pool.query.mock.calls.length - 1][0] as string;
    expect(insertSql).toContain('INSERT INTO game_bans');
    expect(insertSql).toContain('ON CONFLICT (gid, identity, identity_type) DO NOTHING');

    // Next isIdentityBanned hits DB again (cache busted) and now sees the row
    pool.query.mockResolvedValueOnce({rows: [{identity: 'u1', identity_type: 'user'}]});
    pool.query.mockResolvedValueOnce({rows: []});
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
