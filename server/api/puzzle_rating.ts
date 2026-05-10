import express from 'express';
import Joi from 'joi';
import {ipKeyGenerator, rateLimit} from 'express-rate-limit';
import {optionalAuth, requireAuth} from '../auth/middleware';
import {
  getRatingForPuzzle,
  upsertRating,
  deleteRating,
  hasReachedRatingThreshold,
  RATING_THRESHOLD_PERCENT,
} from '../model/puzzle_rating';

const router = express.Router();

const ratingSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
});

const userOrIpKey = (req: express.Request) => req.authUser?.userId || ipKeyGenerator(req.ip || 'unknown');

const ratingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {error: 'Too many requests, please try again later'},
});

/**
 * @openapi
 * /puzzle_rating/{pid}:
 *   get:
 *     tags: [Puzzles]
 *     summary: Get rating aggregate for a puzzle
 *     description: Returns average and count, plus the requesting user's rating if authenticated.
 *     security: [{bearerAuth: []}, {}]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: Rating aggregate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 average: {type: number, nullable: true}
 *                 count: {type: integer}
 *                 userRating: {type: integer, nullable: true}
 */
router.get<{pid: string}>('/:pid', optionalAuth, async (req, res, next) => {
  try {
    const aggregate = await getRatingForPuzzle(req.params.pid, req.authUser?.userId);
    res.json(aggregate);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /puzzle_rating/{pid}:
 *   post:
 *     tags: [Puzzles]
 *     summary: Submit or update a rating for a puzzle
 *     description: Authenticated. Eligible once the user has solved the puzzle or reached 25% on any of their games for it.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: {type: integer, minimum: 1, maximum: 5}
 *     responses:
 *       200: {description: Rating saved}
 *       400: {description: Invalid rating}
 *       401: {description: Authentication required}
 *       403: {description: User has not reached the rating eligibility threshold}
 */
router.post<{pid: string}>('/:pid', ratingLimiter, requireAuth, async (req, res, next) => {
  try {
    const {error, value} = ratingSchema.validate(req.body);
    if (error) {
      res.status(400).json({error: error.details[0].message});
      return;
    }
    const userId = req.authUser!.userId;
    const eligible = await hasReachedRatingThreshold(req.params.pid, userId);
    if (!eligible) {
      res.status(403).json({
        error: 'not_eligible',
        thresholdPercent: RATING_THRESHOLD_PERCENT,
      });
      return;
    }
    await upsertRating(req.params.pid, userId, value.rating);
    const aggregate = await getRatingForPuzzle(req.params.pid, userId);
    res.json(aggregate);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /puzzle_rating/{pid}:
 *   delete:
 *     tags: [Puzzles]
 *     summary: Remove the requesting user's rating for a puzzle
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200: {description: Rating removed (no-op if no rating existed)}
 *       401: {description: Authentication required}
 */
router.delete<{pid: string}>('/:pid', ratingLimiter, requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUser!.userId;
    await deleteRating(req.params.pid, userId);
    const aggregate = await getRatingForPuzzle(req.params.pid, userId);
    res.json(aggregate);
  } catch (err) {
    next(err);
  }
});

export default router;
