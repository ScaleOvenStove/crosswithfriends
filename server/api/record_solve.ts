import * as Sentry from '@sentry/node';
import express from 'express';
import {RecordSolveRequest, RecordSolveResponse} from '../../src/shared/types';
import {recordSolve} from '../model/puzzle';
import {saveGameSnapshot} from '../model/game_snapshot';
import {invalidateInProgressCacheForUser, invalidateSolvedPidsCacheForUser} from '../model/puzzle_solve';
import {
  invalidateUserGamesCacheForUser,
  invalidateUserGamesCacheForUserId,
  invalidateAuthPuzzleStatusCache,
} from '../model/user_games';
import {getDfacIdsForUser} from '../model/user';
import {getGamePid} from '../model/game';
import {wasParticipantOfGame} from '../model/game_moderation';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

// 24 days. Solve time is wall-clock elapsed and large collaborative puzzles
// can legitimately span days, but values beyond this are bogus and would skew
// the median-solve-time aggregate. Capped under 2^31-1 ms (~24.8 days) because
// puzzle_solves.time_taken_to_solve is a 4-byte integer column.
const MAX_SOLVE_MS = 24 * 24 * 60 * 60 * 1000;
const MAX_PLAYER_COUNT = 1000;

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
  const {pid} = req.params;
  const {gid, time_to_solve, player_count, snapshot, keep_replay, dfacId} = req.body;

  // Optional auth: extract userId if token is present
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  try {
    // Validate inputs before touching the DB. These feed the puzzle_solves
    // table and the median-solve-time aggregate, so reject malformed or
    // out-of-range values rather than poisoning the stats.
    if (typeof gid !== 'string' || gid.length === 0) {
      res.status(400).json({error: 'gid is required'});
      return;
    }
    if (typeof time_to_solve !== 'number' || !Number.isFinite(time_to_solve) || time_to_solve < 0) {
      res.status(400).json({error: 'time_to_solve must be a non-negative number'});
      return;
    }
    if (time_to_solve > MAX_SOLVE_MS) {
      res.status(400).json({error: 'time_to_solve is implausibly large'});
      return;
    }
    if (
      player_count != null &&
      (!Number.isInteger(player_count) || player_count < 0 || player_count > MAX_PLAYER_COUNT)
    ) {
      res.status(400).json({error: 'player_count is out of range'});
      return;
    }

    // The caller must actually have played this game. Without this, anyone
    // could fabricate solves for an arbitrary gid (skewing solve-time stats)
    // and overwrite another game's solved-grid snapshot (saveGameSnapshot
    // upserts by gid).
    //
    // For authenticated callers we only trust server-known identities — the
    // server-stamped verifiedUserId and the dfac ids linked to their account.
    // We deliberately ignore the request-body dfacId here: it's client-supplied
    // and visible to co-players, so trusting it would let an authenticated user
    // pass a victim's dfacId and bypass the check. Anonymous callers have no
    // account, so their body dfacId is the only identity available (the legacy
    // unauthenticated guest model).
    let participated = false;
    if (userId) {
      participated = await wasParticipantOfGame(gid, {userId});
      if (!participated) {
        const linkedDfacIds = await getDfacIdsForUser(userId);
        for (const linked of linkedDfacIds) {
          if (await wasParticipantOfGame(gid, {dfacId: linked})) {
            participated = true;
            break;
          }
        }
      }
    } else if (typeof dfacId === 'string' && dfacId.length > 0) {
      participated = await wasParticipantOfGame(gid, {dfacId});
    }
    if (!participated) {
      res.status(403).json({error: 'Not a participant of this game'});
      return;
    }

    // The gid must belong to the puzzle the solve is recorded against, so a
    // solve can't be attributed to (and a snapshot written for) a mismatched
    // puzzle. Skip only when the create event is archived and pid is unknown.
    const gamePid = await getGamePid(gid);
    if (gamePid !== null && gamePid !== pid) {
      res.status(400).json({error: 'gid does not belong to this puzzle'});
      return;
    }

    let solveRecorded = true;
    try {
      await recordSolve(pid, gid, time_to_solve, userId, player_count);
    } catch (solveErr) {
      // Don't abort the snapshot save: a snapshot without a puzzle_solves row
      // is still useful to the user (the game page can reload the solved grid).
      // Tag this report with the orphan context so it's distinguishable from
      // unrelated DB errors when we triage Sentry.
      solveRecorded = false;
      Sentry.captureException(solveErr, {
        level: 'warning',
        extra: {pid, gid, userId, time_to_solve, note: 'snapshot orphaned by solve failure'},
      });
    }
    if (snapshot) {
      await saveGameSnapshot(gid, pid, snapshot, !!keep_replay);
    }
    // Invalidate caches so solved game disappears from in-progress lists.
    // Skip when the solve insert failed — the cached "in progress" view is
    // still accurate, and we don't want to mask the underlying problem.
    if (userId && solveRecorded) {
      invalidateInProgressCacheForUser(userId);
      invalidateAuthPuzzleStatusCache(userId);
      invalidateSolvedPidsCacheForUser(userId);
      invalidateUserGamesCacheForUserId(userId);
      const linkedDfacIds = await getDfacIdsForUser(userId);
      for (const linkedDfacId of linkedDfacIds) invalidateUserGamesCacheForUser(linkedDfacId);
    }
    res.json({});
  } catch (e) {
    next(e);
  }
});

export default router;
