import express from 'express';
import {RecordSolveRequest, RecordSolveResponse} from '../../src/shared/types';
import {recordSolve} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

router.post<{pid: string}, RecordSolveResponse, RecordSolveRequest>('/:pid', async (req, res, next) => {
  const {gid, time_to_solve, player_count} = req.body;

  // Optional auth: extract userId if token is present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  try {
    await recordSolve(req.params.pid, gid, time_to_solve, userId, player_count);
    res.json({});
  } catch (e) {
    next(e);
  }
});

export default router;
