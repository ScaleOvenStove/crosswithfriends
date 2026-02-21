import express from 'express';
import {getGameSnapshot, setReplayRetained} from '../model/game_snapshot';
import {getPuzzle} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';
import {pool} from '../model/pool';

const router = express.Router();

// GET /api/game-snapshot/:gid — returns snapshot or solution-only fallback
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

// POST /api/game-snapshot/:gid/keep-replay — opt in to retaining replay data
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

    const updated = await setReplayRetained(req.params.gid, true);
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
