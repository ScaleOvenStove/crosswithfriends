import express from 'express';
import {optionalAuth} from '../auth/middleware';
import {getUserGamesForPuzzle, getGuestPuzzleStatuses} from '../model/user_games';

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
    next(e);
  }
});

export default router;
