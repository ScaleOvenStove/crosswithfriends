import express from 'express';
import {optionalAuth} from '../auth/middleware';
import {getUserGamesForPuzzle, getGuestPuzzleStatuses} from '../model/user_games';

const router = express.Router();

/**
 * GET /api/user-games?pid=123&dfac_id=abc
 *
 * Returns the requesting user's games for a specific puzzle.
 * Supports both authenticated (Bearer token) and guest (dfac_id param) users.
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
    res.json({games});
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/user-games/statuses?dfac_id=abc
 *
 * Returns puzzle statuses (solved/started) for a guest user.
 * For authenticated users, use GET /api/user-stats/:userId instead.
 */
router.get('/statuses', async (req, res, next) => {
  try {
    const dfacId = req.query.dfac_id as string | undefined;
    if (!dfacId) {
      res.status(400).json({error: 'dfac_id query parameter is required'});
      return;
    }

    const statuses = await getGuestPuzzleStatuses(dfacId);
    res.json({statuses});
  } catch (e) {
    next(e);
  }
});

export default router;
