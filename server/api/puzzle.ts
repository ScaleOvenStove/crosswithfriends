import {AddPuzzleResponse, AddPuzzleRequest} from '@shared/types';
import express from 'express';

import {addPuzzle, getPuzzleInfo} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

router.post<{}, AddPuzzleResponse, AddPuzzleRequest>('/', async (req, res) => {
  console.log('got req', req.headers, req.body);

  // Optional auth: extract userId if token is present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  const result = await addPuzzle(req.body.puzzle, req.body.isPublic, req.body.pid, userId);
  res.json({
    pid: result.pid,
    duplicate: result.duplicate || undefined,
  });
});

router.get<{pid: string}>('/:pid/info', async (req, res, next) => {
  try {
    const info = await getPuzzleInfo(req.params.pid);
    if (!info) {
      res.status(404).json({error: 'Puzzle not found'});
      return;
    }
    res.json(info);
  } catch (e) {
    next(e);
  }
});

export default router;
