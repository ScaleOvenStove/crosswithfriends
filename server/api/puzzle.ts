import {AddPuzzleResponse, AddPuzzleRequest} from '@shared/types';
import express from 'express';

import {addPuzzle, getPuzzleInfo, getPuzzleStats} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

/**
 * @openapi
 * /puzzle:
 *   post:
 *     tags: [Puzzles]
 *     summary: Upload a puzzle
 *     description: Upload a new crossword puzzle. Optionally authenticated to associate the puzzle with a user.
 *     security: [{bearerAuth: []}, {}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [puzzle]
 *             properties:
 *               puzzle: {type: object, description: Puzzle data (grid, clues, info, etc.)}
 *               isPublic: {type: boolean}
 *               pid: {type: string, description: Optional custom puzzle ID}
 *     responses:
 *       200:
 *         description: Puzzle created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid: {type: string}
 *                 duplicate: {type: string, description: PID of existing duplicate if found}
 */
router.post<{}, AddPuzzleResponse | {error: string}, AddPuzzleRequest>('/', async (req, res, next) => {
  // Optional auth: extract userId if token is present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  try {
    const result = await addPuzzle(req.body.puzzle, req.body.isPublic, req.body.pid, userId);
    res.json({
      pid: result.pid,
      duplicate: result.duplicate || undefined,
    });
  } catch (e) {
    // addPuzzle's validatePuzzle throws Error('Invalid puzzle: ...') for
    // structural / placeholder issues. Surface those as 400s so external
    // uploaders get something actionable instead of a generic 500.
    if (e instanceof Error && e.message.startsWith('Invalid puzzle')) {
      console.warn(`[POST /api/puzzle] Rejected upload: ${e.message}`);
      res.status(400).json({error: e.message});
      return;
    }
    next(e);
  }
});

/**
 * @openapi
 * /puzzle/{pid}/info:
 *   get:
 *     tags: [Puzzles]
 *     summary: Get puzzle info
 *     description: Returns metadata about a puzzle (title, author, description, etc.).
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *         description: Puzzle ID
 *     responses:
 *       200:
 *         description: Puzzle info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title: {type: string}
 *                 author: {type: string}
 *                 description: {type: string}
 *       404: {description: Puzzle not found}
 */
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

/**
 * @openapi
 * /puzzle/{pid}/stats:
 *   get:
 *     tags: [Puzzles]
 *     summary: Get aggregate solve stats for a puzzle
 *     description: |
 *       Returns the median completion time across solves (non-zero time, under a 2-hour
 *       cap). Co-op games are reduced to one sample per game. The median is only
 *       populated once a minimum sample size has been reached; below that the response
 *       contains only `sampleCount`.
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *         description: Puzzle ID
 *     responses:
 *       200:
 *         description: Puzzle stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sampleCount: {type: integer, description: Number of clean solves included}
 *                 medianMs: {type: integer, nullable: true, description: Median solve time in ms, or null if below threshold}
 */
router.get<{pid: string}>('/:pid/stats', async (req, res, next) => {
  try {
    const stats = await getPuzzleStats(req.params.pid);
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

export default router;
