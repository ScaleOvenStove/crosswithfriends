import express from 'express';
import {optionalAuth} from '../auth/middleware';
import {getUserGamesForPuzzle, getGuestPuzzleStatuses} from '../model/user_games';
import {isTransientReadFailure} from '../model/pool';
import {reportDegradedRead} from './degraded_read';

const router = express.Router();

/**
 * @openapi
 * /user-games:
 *   get:
 *     tags: [Users]
 *     summary: Get user's games for a puzzle
 *     description: Returns the requesting user's games for a specific puzzle. Supports both authenticated (Bearer token) and guest (dfac_id param) users.
 *     security: [{bearerAuth: []}, {}]
 *     parameters:
 *       - in: query
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *         description: Puzzle ID
 *       - in: query
 *         name: dfac_id
 *         schema: {type: string}
 *         description: Legacy guest ID (required if not authenticated)
 *     responses:
 *       200:
 *         description: List of user's games
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 games: {type: array, items: {type: object}}
 *                 degraded: {type: boolean, description: "Present and true when the lookup could not be completed (statement timeout, or no free DB connection). `games` is then empty for that reason, not because the user has none — treat it as a retryable failure, not an authoritative empty result."}
 *       400: {description: Missing pid or authentication}
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const pid = req.query.pid as string | undefined;
    if (!pid) {
      res.status(400).json({error: 'pid query parameter is required'});
      return;
    }

    const userId = req.authUser?.userId;
    const dfacId = req.query.dfac_id as string | undefined;

    if (!userId && !dfacId) {
      res.status(400).json({error: 'Authentication or dfac_id query parameter is required'});
      return;
    }

    const games = await getUserGamesForPuzzle(pid, {userId, dfacId});
    res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
    res.json({games});
  } catch (e) {
    // A lookup the DB couldn't serve — cancelled for running too long, or
    // never given a connection — shouldn't hard-fail the client:
    // the 500 became a 503 which the frontend then tried to JSON.parse, crashing
    // with "unexpected end of data" (JAVASCRIPT-REACT-5A). Degrade to an empty
    // list — the caller just sees no prior games — while still reporting to
    // Sentry so the underlying slowness stays visible.
    if (isTransientReadFailure(e)) {
      reportDegradedRead('getUserGamesForPuzzle', e, {pid: req.query.pid});
      // Don't let a proxy/browser cache the degraded empty result — once the DB
      // recovers the next request should be able to fetch the real games.
      res.set('Cache-Control', 'no-store');
      // Flag the result as degraded rather than sending a bare empty list. An
      // empty list is indistinguishable from "user has no games", and Play.js
      // autocreates a fresh blank game on games.length === 0 — which would hide
      // the user's real in-progress game on every timeout (the "blank
      // in-progress games" report). fetchUserGames treats `degraded` as a
      // retryable failure, so the client shows an error instead of autocreating.
      res.json({games: [], degraded: true});
      return;
    }
    next(e);
  }
});

/**
 * @openapi
 * /user-games/statuses:
 *   get:
 *     tags: [Users]
 *     summary: Get guest puzzle statuses
 *     description: Returns puzzle statuses (solved/started) for a guest user identified by dfac_id. For authenticated users, use GET /user-stats/{userId} instead.
 *     parameters:
 *       - in: query
 *         name: dfac_id
 *         required: true
 *         schema: {type: string}
 *         description: Legacy guest ID
 *     responses:
 *       200:
 *         description: Puzzle statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statuses: {type: object}
 *                 degraded: {type: boolean, description: "Present and true when the lookup could not be completed. `statuses` is then empty for that reason, not because the guest has played nothing — callers must not cache it as authoritative."}
 *       400: {description: Missing dfac_id}
 */
router.get('/statuses', async (req, res, next) => {
  try {
    const dfacId = req.query.dfac_id as string | undefined;
    if (!dfacId) {
      res.status(400).json({error: 'dfac_id query parameter is required'});
      return;
    }

    const statuses = await getGuestPuzzleStatuses(dfacId);
    res.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    res.json({statuses});
  } catch (e) {
    // Same degrade contract as the main route above, for the same reason. An
    // empty status map is indistinguishable from "this guest has played
    // nothing", and NewPuzzleList writes whatever it receives straight to
    // localStorage — so a saturated read would wipe the guest's Complete and
    // In progress badges until the next successful refresh. Flag it instead;
    // fetchGuestPuzzleStatuses treats `degraded` as a retryable failure and
    // leaves the cached badges alone.
    if (isTransientReadFailure(e)) {
      reportDegradedRead('getGuestPuzzleStatuses', e, {dfacId: req.query.dfac_id});
      res.set('Cache-Control', 'no-store');
      res.json({statuses: {}, degraded: true});
      return;
    }
    next(e);
  }
});

export default router;
