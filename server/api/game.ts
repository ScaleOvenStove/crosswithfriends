import express from 'express';
import {CreateGameResponse, CreateGameRequest, InfoJson, GetGameResponse} from '../../src/shared/types';

import {addInitialGameEvent} from '../model/game';
import {getPuzzleSolves} from '../model/puzzle_solve';
import {getPuzzleInfo} from '../model/puzzle';

const router = express.Router();

router.post<{}, CreateGameResponse, CreateGameRequest>('/', async (req, res) => {
  console.log('got req', req.headers, req.body);
  const gid = await addInitialGameEvent(req.body.gid, req.body.pid);
  res.json({
    gid,
  });
});

router.get<{gid: string}, GetGameResponse>('/:gid', async (req, res) => {
  console.log('got req', req.headers, req.body);
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
    console.error('Error fetching game state:', error);
    res.sendStatus(500);
  }
  return undefined;
});

export default router;
