import * as Sentry from '@sentry/node';
import express from 'express';
import {CreateGameResponse, CreateGameRequest, InfoJson, GetGameResponse} from '../../src/shared/types';

import {addInitialGameEvent} from '../model/game';
import {getPuzzleSolves, invalidateInProgressCacheForUser} from '../model/puzzle_solve';
import {getPuzzleInfo} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';
import {dismissGameForUser, undismissGameForUser} from '../model/game_dismissal';
import {
  invalidateUserGamesCacheForUser,
  invalidateUserGamesCacheForUserId,
  invalidateAuthPuzzleStatusCache,
} from '../model/user_games';
import {getDfacIdsForUser, getUserIdByDfacId} from '../model/user';
import {
  addGameBan,
  clearGameRestriction,
  getGameOwner,
  getGameRestrictions,
  getKickedDfacIds,
  isGameLocked,
  isOwner,
  lockGame,
  removeGameBan,
  RESTRICTABLE_ACTIONS,
  RestrictableAction,
  setGameRestriction,
  unlockGame,
} from '../model/game_moderation';
import {getSocketIo} from '../socket_instance';
import rateLimit, {ipKeyGenerator} from 'express-rate-limit';

const createGameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown'),
  message: {
    error: "You've created several games in a short time. Take a breather and try again in a few minutes.",
  },
  skip: () => process.env.DISABLE_RATE_LIMITS === 'true' || process.env.NODE_ENV === 'test',
});

const router = express.Router();

/**
 * @openapi
 * /game:
 *   post:
 *     tags: [Games]
 *     summary: Create a new game
 *     description: Create a new game session for a puzzle.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gid, pid]
 *             properties:
 *               gid: {type: string, description: Game ID}
 *               pid: {type: string, description: Puzzle ID}
 *     responses:
 *       200:
 *         description: Game created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gid: {type: string}
 *       404: {description: Puzzle not found}
 */
router.post<{}, CreateGameResponse | {error: string}, CreateGameRequest>(
  '/',
  createGameLimiter,
  async (req, res, next) => {
    try {
      // Optional auth — if the caller is signed in, stamp their user_id onto
      // the create event's creator field. The dfac_id from the body is the
      // fallback identity for guests. Either is enough to anchor ownership;
      // both is best (covers sign-out -> rejoin as guest).
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyAccessToken(authHeader.slice(7));
        if (payload) userId = payload.userId;
      }

      const gid = await addInitialGameEvent(req.body.gid, req.body.pid, {
        userId,
        dfacId: req.body.dfac_id,
      });
      // Invalidate user games cache so the "Your Games" page reflects the new game immediately
      if (req.body.dfac_id) {
        invalidateUserGamesCacheForUser(req.body.dfac_id);
      }
      if (userId) {
        invalidateUserGamesCacheForUserId(userId);
      }
      res.json({gid});
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Puzzle not found')) {
        console.error(`[POST /api/game] ${e.message} (gid=${req.body.gid}, pid=${req.body.pid})`);
        res.status(404).json({error: e.message});
      } else {
        console.error(`[POST /api/game] Unexpected error (gid=${req.body.gid}, pid=${req.body.pid}):`, e);
        Sentry.captureException(e, {extra: {gid: req.body.gid, pid: req.body.pid}});
        next(e);
      }
    }
  }
);

/**
 * @openapi
 * /game/{gid}:
 *   get:
 *     tags: [Games]
 *     summary: Get game details
 *     description: Returns game info including title, author, solve duration, and size.
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *         description: Game ID
 *     responses:
 *       200:
 *         description: Game details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gid: {type: string}
 *                 title: {type: string}
 *                 author: {type: string}
 *                 duration: {type: number, description: Solve time in ms}
 *                 size: {type: string}
 *       404: {description: Game not found}
 */
router.get<{gid: string}, GetGameResponse>('/:gid', async (req, res) => {
  try {
    const {gid} = req.params;

    const puzzleSolves = await getPuzzleSolves([gid]);

    if (puzzleSolves.length === 0) {
      return res.sendStatus(404);
    }

    const gameState = puzzleSolves[0];
    const puzzleInfo = (await getPuzzleInfo(gameState.pid)) as InfoJson;

    res.json({
      gid,
      title: gameState.title,
      author: puzzleInfo?.author || 'Unknown',
      duration: gameState.time_taken_to_solve,
      size: gameState.size,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching game state:', error);
    res.sendStatus(500);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/dismiss:
 *   post:
 *     tags: [Games]
 *     summary: Dismiss a game
 *     description: Hide a game from the authenticated user's in-progress list.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       204: {description: Game dismissed}
 *       401: {description: Not authenticated}
 */
router.post<{gid: string}>('/:gid/dismiss', async (req, res, next) => {
  try {
    const {gid} = req.params;

    // Require auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.sendStatus(401);
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    // Per-user dismissal — only hides the game for this user
    await dismissGameForUser(payload.userId, gid);
    // Invalidate caches so dismissed game disappears immediately. The
    // authPuzzleStatusCache feeds the homepage's "started" overlay; without
    // this invalidation the dismissed game keeps showing as in-progress on
    // the homepage until the 10-min TTL expires.
    invalidateInProgressCacheForUser(payload.userId);
    invalidateAuthPuzzleStatusCache(payload.userId);
    invalidateUserGamesCacheForUserId(payload.userId);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    for (const dfacId of dfacIds) invalidateUserGamesCacheForUser(dfacId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/undismiss:
 *   post:
 *     tags: [Games]
 *     summary: Undismiss a game
 *     description: Restore a dismissed game to the authenticated user's in-progress list.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       204: {description: Game restored}
 *       401: {description: Not authenticated}
 */
router.post<{gid: string}>('/:gid/undismiss', async (req, res, next) => {
  try {
    const {gid} = req.params;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.sendStatus(401);
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    await undismissGameForUser(payload.userId, gid);
    invalidateInProgressCacheForUser(payload.userId);
    invalidateAuthPuzzleStatusCache(payload.userId);
    invalidateUserGamesCacheForUserId(payload.userId);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    for (const dfacId of dfacIds) invalidateUserGamesCacheForUser(dfacId);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/moderation:
 *   get:
 *     tags: [Games]
 *     summary: Get moderation state for a game
 *     description: Returns current lock state and owner identity (if any). No auth required; the data is non-sensitive — clients use it to decide whether to render owner controls.
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Moderation state
 */
router.get<{gid: string}>('/:gid/moderation', async (req, res, next) => {
  try {
    const {gid} = req.params;
    const [locked, owner, kickedDfacIds, restrictions] = await Promise.all([
      isGameLocked(gid),
      getGameOwner(gid),
      getKickedDfacIds(gid),
      getGameRestrictions(gid),
    ]);
    // Resolve isOwner server-side when the caller is authenticated. The
    // client-side equivalent only knows the local dfac_id, which misses the
    // cross-device case: user creates as guest on device A (linking that
    // dfac_id to their account when they sign in), then opens the same game
    // on device B with a different dfac_id. The server tracks all dfac_ids
    // linked to the user, so it can answer "are you the owner?" correctly
    // where the client cannot. Mirrors what the moderation HTTP endpoints
    // actually authorize against.
    let isOwnerForCaller = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyAccessToken(authHeader.slice(7));
      if (payload) {
        const dfacIds = await getDfacIdsForUser(payload.userId);
        isOwnerForCaller = isOwner(owner, {userId: payload.userId, dfacIds});
      }
    }
    res.json({locked, owner, kickedDfacIds, restrictions, isOwner: isOwnerForCaller});
  } catch (e) {
    next(e);
  }
});

function isRestrictableAction(value: string): value is RestrictableAction {
  return (RESTRICTABLE_ACTIONS as readonly string[]).includes(value);
}

type KickRequest = {dfac_id?: string; user_id?: string};

/**
 * @openapi
 * /game/{gid}/kick:
 *   post:
 *     tags: [Games]
 *     summary: Kick (ban) a player from a game
 *     description: Owner-only. Bans the target identity from joining or sending events to this gid. Broadcasts a 'kicked' event so the target's client disconnects immediately.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dfac_id: {type: string}
 *               user_id: {type: string}
 *     responses:
 *       204: {description: Player kicked}
 *       400: {description: Missing target identity}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 */
router.post<{gid: string}, {} | {error: string}, KickRequest>('/:gid/kick', async (req, res, next) => {
  try {
    const {gid} = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    const target = req.body || {};
    if (!target.dfac_id && !target.user_id) {
      return res.status(400).json({error: 'target dfac_id or user_id required'});
    }

    const owner = await getGameOwner(gid);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
      return res.status(403).json({error: 'only the game owner can kick'});
    }

    // The client only knows the target's dfac_id (presence list keys),
    // but banning just that lets an authed target rejoin from another
    // browser with a fresh dfac. Resolve the linked user_id server-side
    // and ban both identities so the kick covers every device of the
    // same account. No-op for guests with no linked account.
    let resolvedUserId = target.user_id;
    if (!resolvedUserId && target.dfac_id) {
      resolvedUserId = (await getUserIdByDfacId(target.dfac_id)) || undefined;
    }

    // Refuse self-kicks. The client UI suppresses the kick button for the
    // owner's local dfac, but not for *other* devices of the same account,
    // so clicking kick on a second-device entry would resolve to the
    // owner's own user_id and ban every session. Fail loudly instead.
    if (resolvedUserId === payload.userId || (target.dfac_id && dfacIds.includes(target.dfac_id))) {
      return res.status(400).json({error: 'cannot kick yourself'});
    }

    const banWrites: Promise<void>[] = [];
    if (resolvedUserId) {
      banWrites.push(addGameBan(gid, {identity: resolvedUserId, identityType: 'user'}, payload.userId));
    }
    if (target.dfac_id) {
      banWrites.push(addGameBan(gid, {identity: target.dfac_id, identityType: 'dfac'}, payload.userId));
    }
    await Promise.all(banWrites);

    // Broadcast first so well-behaved kicked clients can call
    // forceDisconnect and show the blocker, then evict the matching
    // sockets from the room server-side. The eviction matters because a
    // malicious client could ignore the broadcast and keep receiving
    // room messages / replaying history — leaving the room cuts off
    // both even without client cooperation. sync_all_game_events also
    // re-checks isIdentityBanned for the same reason.
    const io = getSocketIo();
    if (io) {
      io.to(`game-${gid}`).emit('kicked', {
        gid,
        dfac_id: target.dfac_id,
        user_id: resolvedUserId,
      });
      const sockets = await io.in(`game-${gid}`).fetchSockets();
      for (const s of sockets) {
        const matchesDfac = target.dfac_id && s.data.dfacId === target.dfac_id;
        const matchesUser = resolvedUserId && s.data.authUser?.userId === resolvedUserId;
        if (matchesDfac || matchesUser) {
          s.leave(`game-${gid}`);
        }
      }
    }

    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/unkick:
 *   post:
 *     tags: [Games]
 *     summary: Lift a kick (unban) a player
 *     description: Owner-only. Removes the ban for the given target identity. Resolves the linked user_id so all device-local bans tied to the same account are lifted.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dfac_id: {type: string}
 *               user_id: {type: string}
 *     responses:
 *       204: {description: Player unkicked}
 *       400: {description: Missing target identity}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 */
router.post<{gid: string}, {} | {error: string}, KickRequest>('/:gid/unkick', async (req, res, next) => {
  try {
    const {gid} = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    const target = req.body || {};
    if (!target.dfac_id && !target.user_id) {
      return res.status(400).json({error: 'target dfac_id or user_id required'});
    }

    const owner = await getGameOwner(gid);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
      return res.status(403).json({error: 'only the game owner can unkick'});
    }

    // Mirror /kick: resolve the linked user_id so we remove the user-scoped
    // ban too, not just the dfac-scoped one. Otherwise an authed player who
    // was kicked from another device would still be banned on this device.
    let resolvedUserId = target.user_id;
    if (!resolvedUserId && target.dfac_id) {
      resolvedUserId = (await getUserIdByDfacId(target.dfac_id)) || undefined;
    }

    await removeGameBan(gid, {dfacId: target.dfac_id, userId: resolvedUserId});

    // Mirror /kick's broadcast so other clients can update their local
    // kickedDfacIds (un-grey the presence entry, re-allow as a real player)
    // without a refresh.
    const io = getSocketIo();
    if (io) {
      io.to(`game-${gid}`).emit('unkicked', {
        gid,
        dfac_id: target.dfac_id,
        user_id: resolvedUserId,
      });
    }

    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/lock:
 *   post:
 *     tags: [Games]
 *     summary: Lock a game so no new players can join
 *     description: Owner-only. Existing players continue to play.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       204: {description: Game locked}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 */
router.post<{gid: string}>('/:gid/lock', async (req, res, next) => {
  try {
    const {gid} = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    const owner = await getGameOwner(gid);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
      return res.sendStatus(403);
    }

    await lockGame(gid, {userId: payload.userId, dfacId: dfacIds[0] || null});
    broadcastLockChange(gid, true);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

/**
 * @openapi
 * /game/{gid}/unlock:
 *   post:
 *     tags: [Games]
 *     summary: Unlock a game
 *     description: Owner-only.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       204: {description: Game unlocked}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 */
router.post<{gid: string}>('/:gid/unlock', async (req, res, next) => {
  try {
    const {gid} = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    const owner = await getGameOwner(gid);
    const dfacIds = await getDfacIdsForUser(payload.userId);
    if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
      return res.sendStatus(403);
    }

    await unlockGame(gid);
    broadcastLockChange(gid, false);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

function broadcastLockChange(gid: string, locked: boolean): void {
  // Sibling of broadcastRestrictionChange — emit to everyone in the room
  // so players see the lock chip flip live. Server enforcement (in
  // join_game) is the source of truth; this is purely UX. Existing
  // players keep playing on lock since the lock gate only fires for new
  // joins, but we want them to see the room is closed to new joiners.
  const io = getSocketIo();
  if (io) {
    io.to(`game-${gid}`).emit('lock_changed', {gid, locked});
  }
}

/**
 * @openapi
 * /game/{gid}/restrictions/{action}:
 *   post:
 *     tags: [Games]
 *     summary: Restrict a player action to the owner
 *     description: Owner-only. Marks one of `check`, `reveal`, or `reset` as
 *       owner-only — non-owners in the room cannot dispatch that event. Other
 *       restrictions and the lock state are unaffected.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *       - in: path
 *         name: action
 *         required: true
 *         schema: {type: string, enum: [check, reveal, reset]}
 *     responses:
 *       204: {description: Restriction set}
 *       400: {description: Unknown action}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 *   delete:
 *     tags: [Games]
 *     summary: Lift a restriction
 *     description: Owner-only. Removes an owner-only restriction for the given action.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *       - in: path
 *         name: action
 *         required: true
 *         schema: {type: string, enum: [check, reveal, reset]}
 *     responses:
 *       204: {description: Restriction cleared}
 *       400: {description: Unknown action}
 *       401: {description: Not authenticated}
 *       403: {description: Caller is not the owner}
 */
function broadcastRestrictionChange(gid: string, action: RestrictableAction, restricted: boolean): void {
  // Mirrors the kicked/unkicked broadcast: emit to everyone in the room
  // so non-owner clients can flip their toolbar gating live instead of
  // waiting for a refresh to re-fetch /moderation. Server-side
  // enforcement (in SocketManager.game_event) is the source of truth;
  // this broadcast is just for UX so the menu updates the moment the
  // owner toggles.
  const io = getSocketIo();
  if (io) {
    io.to(`game-${gid}`).emit('restrictions_changed', {gid, action, restricted});
  }
}

router.post<{gid: string; action: string}, {} | {error: string}>(
  '/:gid/restrictions/:action',
  async (req, res, next) => {
    try {
      const {gid, action} = req.params;
      if (!isRestrictableAction(action)) {
        return res.status(400).json({error: 'unknown action'});
      }
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
      const payload = verifyAccessToken(authHeader.slice(7));
      if (!payload) return res.sendStatus(401);

      const owner = await getGameOwner(gid);
      const dfacIds = await getDfacIdsForUser(payload.userId);
      if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
        return res.sendStatus(403);
      }

      await setGameRestriction(gid, action, {userId: payload.userId, dfacId: dfacIds[0] || null});
      broadcastRestrictionChange(gid, action, true);
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
    return undefined;
  }
);

router.delete<{gid: string; action: string}, {} | {error: string}>(
  '/:gid/restrictions/:action',
  async (req, res, next) => {
    try {
      const {gid, action} = req.params;
      if (!isRestrictableAction(action)) {
        return res.status(400).json({error: 'unknown action'});
      }
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
      const payload = verifyAccessToken(authHeader.slice(7));
      if (!payload) return res.sendStatus(401);

      const owner = await getGameOwner(gid);
      const dfacIds = await getDfacIdsForUser(payload.userId);
      if (!isOwner(owner, {userId: payload.userId, dfacIds})) {
        return res.sendStatus(403);
      }

      await clearGameRestriction(gid, action);
      broadcastRestrictionChange(gid, action, false);
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
    return undefined;
  }
);

export default router;
