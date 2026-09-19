import express from 'express';
import request from 'supertest';

/**
 * Route-level tests for the owner-only moderation endpoints in api/game.ts.
 *
 * The model layer (game_moderation.ts) is covered separately; what is pinned
 * here is the HTTP authorization wiring, which is where a regression would be
 * invisible to the model tests: which routes demand a Bearer token, which
 * demand ownership, and what each returns when the caller is neither.
 *
 * `isOwner` is deliberately NOT mocked — it is pure logic and it is the
 * decision under test. Everything that touches the database or Socket.IO is.
 */

jest.mock('../../model/pool', () => require('../../__mocks__/pool'));

const mockGetGameOwner = jest.fn();
const mockIsGameLocked = jest.fn();
const mockGetKickedDfacIds = jest.fn();
const mockGetGameRestrictions = jest.fn();
const mockAddGameBan = jest.fn();
const mockRemoveGameBan = jest.fn();
const mockLockGame = jest.fn();
const mockUnlockGame = jest.fn();
const mockSetGameRestriction = jest.fn();
const mockClearGameRestriction = jest.fn();

jest.mock('../../model/game_moderation', () => {
  const actual = jest.requireActual('../../model/game_moderation');
  return {
    // The authorization predicate itself stays real.
    isOwner: actual.isOwner,
    RESTRICTABLE_ACTIONS: actual.RESTRICTABLE_ACTIONS,
    getGameOwner: (...a: unknown[]) => mockGetGameOwner(...a),
    isGameLocked: (...a: unknown[]) => mockIsGameLocked(...a),
    getKickedDfacIds: (...a: unknown[]) => mockGetKickedDfacIds(...a),
    getGameRestrictions: (...a: unknown[]) => mockGetGameRestrictions(...a),
    addGameBan: (...a: unknown[]) => mockAddGameBan(...a),
    removeGameBan: (...a: unknown[]) => mockRemoveGameBan(...a),
    lockGame: (...a: unknown[]) => mockLockGame(...a),
    unlockGame: (...a: unknown[]) => mockUnlockGame(...a),
    setGameRestriction: (...a: unknown[]) => mockSetGameRestriction(...a),
    clearGameRestriction: (...a: unknown[]) => mockClearGameRestriction(...a),
  };
});

const mockGetDfacIdsForUser = jest.fn();
const mockGetUserIdByDfacId = jest.fn();
jest.mock('../../model/user', () => ({
  getDfacIdsForUser: (...a: unknown[]) => mockGetDfacIdsForUser(...a),
  getUserIdByDfacId: (...a: unknown[]) => mockGetUserIdByDfacId(...a),
}));

jest.mock('../../model/game', () => ({addInitialGameEvent: jest.fn()}));
jest.mock('../../model/puzzle', () => ({getPuzzleInfo: jest.fn()}));
jest.mock('../../model/puzzle_solve', () => ({
  getPuzzleSolves: jest.fn().mockResolvedValue([]),
  invalidateInProgressCacheForUser: jest.fn(),
}));
jest.mock('../../model/game_dismissal', () => ({
  dismissGameForUser: jest.fn(),
  undismissGameForUser: jest.fn(),
}));
jest.mock('../../model/user_games', () => ({
  invalidateUserGamesCacheForUser: jest.fn(),
  invalidateUserGamesCacheForUserId: jest.fn(),
  invalidateAuthPuzzleStatusCache: jest.fn(),
}));

const mockEmit = jest.fn();
const mockFetchSockets = jest.fn();
let mockIo: unknown = null;
jest.mock('../../socket_instance', () => ({
  getSocketIo: () => mockIo,
}));

jest.mock('@sentry/node', () => ({captureException: jest.fn()}));

// Imported after the mocks so the router binds to them.
import {signAccessToken} from '../../auth/jwt';

const OWNER_USER = 'user-owner';
const OTHER_USER = 'user-other';
const OWNER_DFAC = 'dfac-owner';

function tokenFor(userId: string): string {
  return signAccessToken({userId, email: null, displayName: null});
}

function buildApp() {
  const router = require('../../api/game').default;
  const app = express();
  app.use(express.json());
  app.use('/game', router);
  return app;
}

/** Socket.IO test double: records emits and hands back the given sockets. */
function fakeIo(socketsInRoom: Array<{data: any; leave: jest.Mock}> = []) {
  mockFetchSockets.mockResolvedValue(socketsInRoom);
  return {
    to: () => ({emit: mockEmit}),
    in: () => ({fetchSockets: mockFetchSockets}),
  };
}

/**
 * Every owner-gated route, as [method, path, expected non-owner status].
 * lock/unlock/restrictions use sendStatus(403) (empty body); kick/unkick
 * return a JSON error. Both shapes are asserted below.
 */
const OWNER_ONLY_ROUTES: Array<['post' | 'delete', string]> = [
  ['post', '/game/g1/kick'],
  ['post', '/game/g1/unkick'],
  ['post', '/game/g1/lock'],
  ['post', '/game/g1/unlock'],
  ['post', '/game/g1/restrictions/check'],
  ['delete', '/game/g1/restrictions/check'],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockIo = null;
  mockGetGameOwner.mockResolvedValue({userId: OWNER_USER, dfacId: OWNER_DFAC});
  mockGetDfacIdsForUser.mockResolvedValue([]);
  mockGetUserIdByDfacId.mockResolvedValue(null);
  mockIsGameLocked.mockResolvedValue(false);
  mockGetKickedDfacIds.mockResolvedValue([]);
  mockGetGameRestrictions.mockResolvedValue({check: false, reveal: false, reset: false});
  mockAddGameBan.mockResolvedValue(undefined);
  mockRemoveGameBan.mockResolvedValue(undefined);
  mockLockGame.mockResolvedValue(undefined);
  mockUnlockGame.mockResolvedValue(undefined);
  mockSetGameRestriction.mockResolvedValue(undefined);
  mockClearGameRestriction.mockResolvedValue(undefined);
});

describe('owner-only moderation routes — authentication', () => {
  it.each(OWNER_ONLY_ROUTES)('%s %s rejects a request with no Authorization header', async (method, path) => {
    const res = await (request(buildApp()) as any)[method](path).send({dfac_id: 'dfac-target'});
    expect(res.status).toBe(401);
  });

  it.each(OWNER_ONLY_ROUTES)('%s %s rejects a malformed Authorization header', async (method, path) => {
    const res = await (request(buildApp()) as any)
      [method](path)
      .set('Authorization', 'Basic abc123')
      .send({dfac_id: 'dfac-target'});
    expect(res.status).toBe(401);
  });

  it.each(OWNER_ONLY_ROUTES)('%s %s rejects a token that does not verify', async (method, path) => {
    const res = await (request(buildApp()) as any)
      [method](path)
      .set('Authorization', 'Bearer not-a-real-jwt')
      .send({dfac_id: 'dfac-target'});
    expect(res.status).toBe(401);
  });

  it('never reaches the model layer for an unauthenticated caller', async () => {
    await request(buildApp()).post('/game/g1/lock');
    expect(mockLockGame).not.toHaveBeenCalled();
    expect(mockGetGameOwner).not.toHaveBeenCalled();
  });
});

describe('owner-only moderation routes — authorization', () => {
  it.each(OWNER_ONLY_ROUTES)('%s %s rejects an authenticated non-owner', async (method, path) => {
    const res = await (request(buildApp()) as any)
      [method](path)
      .set('Authorization', `Bearer ${tokenFor(OTHER_USER)}`)
      .send({dfac_id: 'dfac-target'});
    expect(res.status).toBe(403);
  });

  it('kick and unkick explain the 403 in the body', async () => {
    const app = buildApp();
    const auth = `Bearer ${tokenFor(OTHER_USER)}`;

    const kick = await request(app).post('/game/g1/kick').set('Authorization', auth).send({dfac_id: 'x'});
    expect(kick.body).toEqual({error: 'only the game owner can kick'});

    const unkick = await request(app).post('/game/g1/unkick').set('Authorization', auth).send({dfac_id: 'x'});
    expect(unkick.body).toEqual({error: 'only the game owner can unkick'});
  });

  it.each(OWNER_ONLY_ROUTES)(
    '%s %s performs no mutation when the caller is not the owner',
    async (method, path) => {
      await (request(buildApp()) as any)
        [method](path)
        .set('Authorization', `Bearer ${tokenFor(OTHER_USER)}`)
        .send({dfac_id: 'dfac-target'});

      expect(mockAddGameBan).not.toHaveBeenCalled();
      expect(mockRemoveGameBan).not.toHaveBeenCalled();
      expect(mockLockGame).not.toHaveBeenCalled();
      expect(mockUnlockGame).not.toHaveBeenCalled();
      expect(mockSetGameRestriction).not.toHaveBeenCalled();
      expect(mockClearGameRestriction).not.toHaveBeenCalled();
    }
  );

  it('accepts the owner identified by user_id', async () => {
    mockIo = fakeIo();
    const res = await request(buildApp())
      .post('/game/g1/lock')
      .set('Authorization', `Bearer ${tokenFor(OWNER_USER)}`);

    expect(res.status).toBe(204);
    expect(mockLockGame).toHaveBeenCalledWith('g1', {userId: OWNER_USER, dfacId: null});
  });

  it('accepts the owner identified only by a linked dfac_id', async () => {
    // Guest-created game: the create event carries a dfacId but no userId.
    // The caller signed in later and linked that dfac to their account, so
    // ownership has to resolve through getDfacIdsForUser, not the token.
    mockGetGameOwner.mockResolvedValue({dfacId: OWNER_DFAC});
    mockGetDfacIdsForUser.mockResolvedValue([OWNER_DFAC, 'dfac-second-device']);
    mockIo = fakeIo();

    const res = await request(buildApp())
      .post('/game/g1/lock')
      .set('Authorization', `Bearer ${tokenFor(OTHER_USER)}`);

    expect(res.status).toBe(204);
    expect(mockLockGame).toHaveBeenCalledWith('g1', {userId: OTHER_USER, dfacId: OWNER_DFAC});
  });

  it.each(OWNER_ONLY_ROUTES)(
    '%s %s is closed to everyone on a game created before ownership was recorded',
    async (method, path) => {
      // getGameOwner returns null for legacy games. Documented behaviour:
      // nobody can moderate them, including the person who created them.
      mockGetGameOwner.mockResolvedValue(null);

      const res = await (request(buildApp()) as any)
        [method](path)
        .set('Authorization', `Bearer ${tokenFor(OWNER_USER)}`)
        .send({dfac_id: 'dfac-target'});

      expect(res.status).toBe(403);
    }
  );
});

describe('POST /game/:gid/kick', () => {
  const ownerAuth = () => `Bearer ${tokenFor(OWNER_USER)}`;

  it('requires a target identity', async () => {
    const res = await request(buildApp()).post('/game/g1/kick').set('Authorization', ownerAuth()).send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({error: 'target dfac_id or user_id required'});
    expect(mockAddGameBan).not.toHaveBeenCalled();
  });

  it('bans both the dfac and the account it resolves to', async () => {
    // A kicked player with an account could otherwise rejoin from a second
    // browser with a fresh dfac_id, so the dfac ban alone is not enough.
    mockGetUserIdByDfacId.mockResolvedValue('user-target');
    mockIo = fakeIo();

    const res = await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-target'});

    expect(res.status).toBe(204);
    expect(mockAddGameBan).toHaveBeenCalledWith(
      'g1',
      {identity: 'user-target', identityType: 'user'},
      OWNER_USER
    );
    expect(mockAddGameBan).toHaveBeenCalledWith(
      'g1',
      {identity: 'dfac-target', identityType: 'dfac'},
      OWNER_USER
    );
  });

  it('bans only the dfac for a guest with no linked account', async () => {
    mockGetUserIdByDfacId.mockResolvedValue(null);
    mockIo = fakeIo();

    await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-guest'});

    expect(mockAddGameBan).toHaveBeenCalledTimes(1);
    expect(mockAddGameBan).toHaveBeenCalledWith(
      'g1',
      {identity: 'dfac-guest', identityType: 'dfac'},
      OWNER_USER
    );
  });

  it('refuses a self-kick by user_id', async () => {
    const res = await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({user_id: OWNER_USER});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({error: 'cannot kick yourself'});
    expect(mockAddGameBan).not.toHaveBeenCalled();
  });

  it('refuses a self-kick aimed at the owner’s own second device', async () => {
    // The UI hides the kick button for the owner's local dfac but not for
    // their other devices; without this guard that click would ban every
    // session the owner has.
    mockGetDfacIdsForUser.mockResolvedValue([OWNER_DFAC, 'dfac-owner-phone']);

    const res = await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-owner-phone'});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({error: 'cannot kick yourself'});
    expect(mockAddGameBan).not.toHaveBeenCalled();
  });

  it('refuses a self-kick where the dfac resolves back to the caller', async () => {
    mockGetUserIdByDfacId.mockResolvedValue(OWNER_USER);

    const res = await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-unlinked-but-same-account'});

    expect(res.status).toBe(400);
    expect(mockAddGameBan).not.toHaveBeenCalled();
  });

  it('broadcasts the kick and evicts the target’s sockets from the room', async () => {
    mockGetUserIdByDfacId.mockResolvedValue('user-target');
    const targetByDfac = {data: {dfacId: 'dfac-target'}, leave: jest.fn()};
    const targetByUser = {data: {authUser: {userId: 'user-target'}}, leave: jest.fn()};
    const bystander = {data: {dfacId: 'dfac-bystander'}, leave: jest.fn()};
    mockIo = fakeIo([targetByDfac, targetByUser, bystander]);

    await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-target'});

    expect(mockEmit).toHaveBeenCalledWith('kicked', {
      gid: 'g1',
      dfac_id: 'dfac-target',
      user_id: 'user-target',
    });
    // A client that ignores the broadcast still stops receiving room traffic.
    expect(targetByDfac.leave).toHaveBeenCalledWith('game-g1');
    expect(targetByUser.leave).toHaveBeenCalledWith('game-g1');
    expect(bystander.leave).not.toHaveBeenCalled();
  });

  it('still bans when Socket.IO is not wired up', async () => {
    mockIo = null;

    const res = await request(buildApp())
      .post('/game/g1/kick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-target'});

    expect(res.status).toBe(204);
    expect(mockAddGameBan).toHaveBeenCalled();
  });
});

describe('POST /game/:gid/unkick', () => {
  const ownerAuth = () => `Bearer ${tokenFor(OWNER_USER)}`;

  it('requires a target identity', async () => {
    const res = await request(buildApp()).post('/game/g1/unkick').set('Authorization', ownerAuth()).send({});

    expect(res.status).toBe(400);
    expect(mockRemoveGameBan).not.toHaveBeenCalled();
  });

  it('lifts the account ban as well as the device ban', async () => {
    mockGetUserIdByDfacId.mockResolvedValue('user-target');
    mockIo = fakeIo();

    const res = await request(buildApp())
      .post('/game/g1/unkick')
      .set('Authorization', ownerAuth())
      .send({dfac_id: 'dfac-target'});

    expect(res.status).toBe(204);
    expect(mockRemoveGameBan).toHaveBeenCalledWith('g1', {
      dfacId: 'dfac-target',
      userId: 'user-target',
    });
    expect(mockEmit).toHaveBeenCalledWith('unkicked', {
      gid: 'g1',
      dfac_id: 'dfac-target',
      user_id: 'user-target',
    });
  });
});

describe('POST/DELETE /game/:gid/lock', () => {
  const ownerAuth = () => `Bearer ${tokenFor(OWNER_USER)}`;

  it('locks and broadcasts the new state', async () => {
    mockIo = fakeIo();
    const res = await request(buildApp()).post('/game/g1/lock').set('Authorization', ownerAuth());

    expect(res.status).toBe(204);
    expect(mockLockGame).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith('lock_changed', {gid: 'g1', locked: true});
  });

  it('unlocks and broadcasts the new state', async () => {
    mockIo = fakeIo();
    const res = await request(buildApp()).post('/game/g1/unlock').set('Authorization', ownerAuth());

    expect(res.status).toBe(204);
    expect(mockUnlockGame).toHaveBeenCalledWith('g1');
    expect(mockEmit).toHaveBeenCalledWith('lock_changed', {gid: 'g1', locked: false});
  });
});

describe('/game/:gid/restrictions/:action', () => {
  const ownerAuth = () => `Bearer ${tokenFor(OWNER_USER)}`;

  it.each(['check', 'reveal', 'reset'])('sets the %s restriction', async (action) => {
    mockIo = fakeIo();
    const res = await request(buildApp())
      .post(`/game/g1/restrictions/${action}`)
      .set('Authorization', ownerAuth());

    expect(res.status).toBe(204);
    expect(mockSetGameRestriction).toHaveBeenCalledWith('g1', action, {
      userId: OWNER_USER,
      dfacId: null,
    });
    expect(mockEmit).toHaveBeenCalledWith('restrictions_changed', {gid: 'g1', action, restricted: true});
  });

  it.each(['check', 'reveal', 'reset'])('clears the %s restriction', async (action) => {
    mockIo = fakeIo();
    const res = await request(buildApp())
      .delete(`/game/g1/restrictions/${action}`)
      .set('Authorization', ownerAuth());

    expect(res.status).toBe(204);
    expect(mockClearGameRestriction).toHaveBeenCalledWith('g1', action);
    expect(mockEmit).toHaveBeenCalledWith('restrictions_changed', {gid: 'g1', action, restricted: false});
  });

  it('rejects an action outside the allowed set', async () => {
    const res = await request(buildApp())
      .post('/game/g1/restrictions/delete-everything')
      .set('Authorization', ownerAuth());

    expect(res.status).toBe(400);
    expect(res.body).toEqual({error: 'unknown action'});
    expect(mockSetGameRestriction).not.toHaveBeenCalled();
  });

  it('validates the action before authenticating, so an unknown action reads 400 not 401', async () => {
    // Pinning the current ordering: the 400 leaks nothing (the action list is
    // public) and it gives clients a clearer error than a blanket 401.
    const res = await request(buildApp()).post('/game/g1/restrictions/nonsense');
    expect(res.status).toBe(400);
  });
});

describe('GET /game/:gid/moderation', () => {
  it('is readable without a token and reports the caller as a non-owner', async () => {
    mockIsGameLocked.mockResolvedValue(true);
    mockGetKickedDfacIds.mockResolvedValue(['dfac-kicked']);

    const res = await request(buildApp()).get('/game/g1/moderation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      locked: true,
      owner: {userId: OWNER_USER, dfacId: OWNER_DFAC},
      kickedDfacIds: ['dfac-kicked'],
      restrictions: {check: false, reveal: false, reset: false},
      isOwner: false,
    });
  });

  it('resolves isOwner server-side for the owner', async () => {
    const res = await request(buildApp())
      .get('/game/g1/moderation')
      .set('Authorization', `Bearer ${tokenFor(OWNER_USER)}`);

    expect(res.body.isOwner).toBe(true);
  });

  it('resolves isOwner across devices via the caller’s linked dfac ids', async () => {
    // The client-side check only knows this device's dfac_id and would answer
    // false here; the server knows every dfac linked to the account.
    mockGetGameOwner.mockResolvedValue({dfacId: OWNER_DFAC});
    mockGetDfacIdsForUser.mockResolvedValue([OWNER_DFAC]);

    const res = await request(buildApp())
      .get('/game/g1/moderation')
      .set('Authorization', `Bearer ${tokenFor(OTHER_USER)}`);

    expect(res.body.isOwner).toBe(true);
  });

  it('reports isOwner false for a game with no recorded creator', async () => {
    mockGetGameOwner.mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/game/g1/moderation')
      .set('Authorization', `Bearer ${tokenFor(OWNER_USER)}`);

    expect(res.body.isOwner).toBe(false);
  });
});

describe('dismiss / undismiss', () => {
  it.each([
    ['dismiss', '/game/g1/dismiss'],
    ['undismiss', '/game/g1/undismiss'],
  ])('%s requires authentication', async (_label, path) => {
    const res = await request(buildApp()).post(path);
    expect(res.status).toBe(401);
  });

  it.each([
    ['dismiss', '/game/g1/dismiss'],
    ['undismiss', '/game/g1/undismiss'],
  ])('%s rejects an unverifiable token', async (_label, path) => {
    const res = await request(buildApp()).post(path).set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('dismiss is not owner-gated — any signed-in player may hide their own copy', async () => {
    const res = await request(buildApp())
      .post('/game/g1/dismiss')
      .set('Authorization', `Bearer ${tokenFor(OTHER_USER)}`);

    expect(res.status).toBe(204);
  });
});
