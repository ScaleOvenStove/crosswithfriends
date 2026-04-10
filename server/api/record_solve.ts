import express from 'express';
import {RecordSolveRequest, RecordSolveResponse} from '../../src/shared/types';
import {recordSolve} from '../model/puzzle';
import {saveGameSnapshot} from '../model/game_snapshot';
import {invalidateInProgressCacheForUser} from '../model/puzzle_solve';
import {invalidateUserGamesCacheForUser, invalidateAuthPuzzleStatusCache} from '../model/user_games';
import {getDfacIdsForUser} from '../model/user';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

/**
 * @openapi
 * /record_solve/{pid}:
 *   post:
 *     tags: [Puzzles]
 *     summary: Record a puzzle solve
 *     description: Record that a puzzle was solved, with timing and snapshot data. Optionally authenticated.
 *     security: [{bearerAuth: []}, {}]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *         description: Puzzle ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gid, time_to_solve, player_count]
 *             properties:
 *               gid: {type: string, description: Game ID}
 *               time_to_solve: {type: number, description: Solve time in milliseconds}
 *               player_count: {type: integer}
 *               snapshot: {type: object, description: Grid snapshot data}
 *               keep_replay: {type: boolean, description: Whether to retain replay data}
 *     responses:
 *       200:
 *         description: Solve recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post<{pid: string}, RecordSolveResponse, RecordSolveRequest>('/:pid', async (req, res, next) => {
  const {gid, time_to_solve, player_count, snapshot, keep_replay} = req.body;

  // Optional auth: extract userId if token is present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  try {
    await recordSolve(req.params.pid, gid, time_to_solve, userId, player_count);
    if (snapshot) {
      await saveGameSnapshot(gid, req.params.pid, snapshot, !!keep_replay);
    }
    // Invalidate caches so solved game disappears from in-progress lists
    if (userId) {
      invalidateInProgressCacheForUser(userId);
      invalidateAuthPuzzleStatusCache(userId);
      const dfacIds = await getDfacIdsForUser(userId);
      for (const dfacId of dfacIds) invalidateUserGamesCacheForUser(dfacId);
    }
    res.json({});
  } catch (e) {
    next(e);
  }
});

export default router;
