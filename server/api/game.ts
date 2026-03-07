import * as Sentry from '@sentry/node';
import express from 'express';
import {CreateGameResponse, CreateGameRequest, InfoJson, GetGameResponse} from '../../src/shared/types';

import {addInitialGameEvent} from '../model/game';
import {getPuzzleSolves} from '../model/puzzle_solve';
import {getPuzzleInfo} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';
import {dismissGameForUser, undismissGameForUser} from '../model/game_dismissal';

const router = express.Router();

router.post<{}, CreateGameResponse | {error: string}, CreateGameRequest>('/', async (req, res, next) => {
  try {
    const gid = await addInitialGameEvent(req.body.gid, req.body.pid);
    res.json({gid});
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Puzzle not found')) {
      res.status(404).json({error: e.message});
    } else {
      next(e);
    }
  }
});

router.get<{gid: string}, GetGameResponse>('/:gid', async (req, res) => {
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
    Sentry.captureException(error);
    console.error('Error fetching game state:', error);
    res.sendStatus(500);
  }
  return undefined;
});

router.post<{gid: string}>('/:gid/dismiss', async (req, res, next) => {
  try {
    const {gid} = req.params;

    // Require auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.sendStatus(401);
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    // Per-user dismissal — only hides the game for this user
    await dismissGameForUser(payload.userId, gid);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

router.post<{gid: string}>('/:gid/undismiss', async (req, res, next) => {
  try {
    const {gid} = req.params;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.sendStatus(401);
    }
    const payload = verifyAccessToken(authHeader.slice(7));
    if (!payload) return res.sendStatus(401);

    await undismissGameForUser(payload.userId, gid);
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
  return undefined;
});

export default router;
