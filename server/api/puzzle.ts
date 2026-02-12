import {AddPuzzleResponse, AddPuzzleRequest} from '@shared/types';
import express from 'express';

import {addPuzzle} from '../model/puzzle';
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

export default router;
