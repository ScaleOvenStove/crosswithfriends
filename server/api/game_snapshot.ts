import express from 'express';
import {getGameSnapshot, setReplayRetained} from '../model/game_snapshot';
import {getPuzzle} from '../model/puzzle';
import {wasParticipantOfGame} from '../model/game_moderation';
import {getDfacIdsForUser} from '../model/user';
import {verifyAccessToken} from '../auth/jwt';
import {pool} from '../model/pool';

const router = express.Router();

/**
 * @openapi
 * /game-snapshot/{gid}:
 *   get:
 *     tags: [Games]
 *     summary: Get game snapshot
 *     description: Returns a solved game snapshot with grid state, or falls back to the puzzle solution if no snapshot exists.
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Game snapshot or solution fallback
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: {type: string, enum: [snapshot, solution_only]}
 *                 gid: {type: string}
 *                 pid: {type: string}
 *       404: {description: No snapshot or solve record found}
 */
router.get('/:gid', async (req, res, next) => {
  try {
    const {gid} = req.params;

    // Try the snapshot table first
    const snapshot = await getGameSnapshot(gid);
    if (snapshot) {
      res.json({type: 'snapshot', ...snapshot});
      return;
    }

    // Fallback: look up the puzzle via puzzle_solves and return the solution
    const solveResult = await pool.query(
      `SELECT ps.pid, ps.solved_time, ps.time_taken_to_solve, ps.player_count
       FROM puzzle_solves ps WHERE ps.gid = $1 LIMIT 1`,
      [gid]
    );
    if (solveResult.rows.length === 0) {
      res.status(404).json({error: 'No snapshot or solve record found'});
      return;
    }

    const {pid, solved_time, time_taken_to_solve, player_count} = solveResult.rows[0];
    const puzzle = await getPuzzle(pid);
    if (!puzzle) {
      res.status(404).json({error: 'Puzzle not found'});
      return;
    }
    res.json({
      type: 'solution_only',
      gid,
      pid,
      solution: puzzle.solution,
      info: puzzle.info,
      grid: puzzle.grid,
      clues: puzzle.clues,
      solvedTime: solved_time,
      timeTakenToSolve: time_taken_to_solve,
      playerCount: player_count,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /game-snapshot/{gid}/keep-replay:
 *   post:
 *     tags: [Games]
 *     summary: Retain replay data
 *     description: Opt in to keeping the replay data for a completed game.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: gid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Replay retained
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: {type: boolean}
 *       401: {description: Not authenticated}
 *       404: {description: No snapshot found}
 */
router.post('/:gid/keep-replay', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({error: 'Authentication required'});
      return;
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) {
      res.status(401).json({error: 'Invalid token'});
      return;
    }

    // Only a participant of the game may retain its replay. Without this any
    // authenticated user could flip replay_retained on an arbitrary gid by
    // enumerating game ids. Check the verified user id first, then fall back
    // to any of the user's linked legacy dfac ids (games they played as a
    // guest before logging in).
    const {gid} = req.params;
    let participated = await wasParticipantOfGame(gid, {userId: payload.userId});
    if (!participated) {
      const dfacIds = await getDfacIdsForUser(payload.userId);
      for (const dfacId of dfacIds) {
        if (await wasParticipantOfGame(gid, {dfacId})) {
          participated = true;
          break;
        }
      }
    }
    if (!participated) {
      res.status(403).json({error: 'Not a participant of this game'});
      return;
    }

    const updated = await setReplayRetained(gid, true);
    if (!updated) {
      res.status(404).json({error: 'No snapshot found for this game'});
      return;
    }
    res.json({ok: true});
  } catch (e) {
    next(e);
  }
});

export default router;
