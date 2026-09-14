import express from 'express';
import {getUserSolveStats, getInProgressGames, getSolvedPidsForUser} from '../model/puzzle_solve';
import {getUserById} from '../model/user';
import {getUserUploadedPuzzles} from '../model/puzzle';
import {getAuthenticatedPuzzleStatuses} from '../model/user_games';
import {isTransientReadFailure} from '../model/pool';
import {reportDegradedRead} from './degraded_read';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

/**
 * @openapi
 * /user-stats/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile and stats
 *     description: "Returns solve stats, history, uploads, and in-progress games for a user. Private profiles return {isPrivate: true} unless the requester is the owner."
 *     security: [{bearerAuth: []}, {}]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: User stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isPrivate: {type: boolean, description: Present when profile is private}
 *                 user:
 *                   type: object
 *                   properties:
 *                     displayName: {type: string}
 *                     createdAt: {type: string, format: date-time}
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalSolved: {type: integer}
 *                     bySize: {type: object}
 *                     byDay: {type: object}
 *                 history: {type: array, items: {type: object}}
 *                 uploads: {type: array, items: {type: object}}
 *                 inProgress: {type: array, items: {type: object}, description: Only present for the profile owner}
 *                 degraded: {type: boolean, description: "Present and true when any section could not be read (statement timeout, or no free DB connection). The response is incomplete — do not cache it as authoritative. This is response-level; to tell whether a particular section is affected, check whether its field is absent."}
 *                 inProgress: {type: array, items: {type: object}, description: "Absent if the read failed (as opposed to empty, meaning no in-progress games)."}
 *                 snapshotStatuses: {type: object, description: "Absent if the read failed (as opposed to empty, meaning no snapshot statuses)."}
 *                 solvedPids: {type: array, items: {type: string}, description: "Distinct pids the user has solved. Populated only for the profile owner (empty array otherwise). Used by the puzzle list to overlay the Complete badge."}
 *       404: {description: User not found}
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const {userId} = req.params;

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({error: 'User not found'});
      return;
    }

    // Determine who is requesting — optional auth (don't require it)
    let requestingUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyAccessToken(authHeader.slice(7));
      if (payload) requestingUserId = payload.userId;
    }

    const isOwner = requestingUserId === userId;

    // If profile is private and viewer is not the owner, reveal nothing
    if (!user.profile_is_public && !isOwner) {
      res.json({isPrivate: true});
      return;
    }

    // Degrade gracefully if the stats query trips statement_timeout: render the
    // profile with empty stats rather than 500-ing the whole page (which the
    // frontend surfaces as a hard error). The underlying slowness stays visible
    // in Sentry via reportDegradedRead.
    let solveStats: Awaited<ReturnType<typeof getUserSolveStats>>;
    let isDegraded = false;
    // Any section that fell back to empty data because the DB was saturated
    // makes the whole response incomplete, not just that section — so record it
    // centrally rather than only for the stats block. An incomplete profile that
    // looks complete gets cached for 30s and, worse, persisted client-side as
    // authoritative (see the `degraded` flag on the response below).
    const degradeOn = (section: string, err: unknown): void => {
      reportDegradedRead(section, err, {userId});
      if (isTransientReadFailure(err)) isDegraded = true;
    };
    try {
      solveStats = await getUserSolveStats(userId);
    } catch (err) {
      if (!isTransientReadFailure(err)) throw err;
      degradeOn('getUserSolveStats', err);
      solveStats = {
        totalSolved: 0,
        totalSolvedSolo: 0,
        totalSolvedCoop: 0,
        bySize: [],
        byDay: [],
        bySizeSolo: [],
        bySizeCoop: [],
        byDaySolo: [],
        byDayCoop: [],
        history: [],
      };
    }
    const {
      totalSolved,
      totalSolvedSolo,
      totalSolvedCoop,
      bySize,
      byDay,
      bySizeSolo,
      bySizeCoop,
      byDaySolo,
      byDayCoop,
      history,
    } = solveStats;

    let uploads: Awaited<ReturnType<typeof getUserUploadedPuzzles>> = [];
    try {
      uploads = await getUserUploadedPuzzles(userId);
    } catch (err) {
      degradeOn('getUserUploadedPuzzles', err);
    }

    // These three are the inputs the client builds its puzzle-status map from.
    // Each stays undefined if its read fails (rather than falling back to an
    // empty value) so the client can distinguish "you have none" from "we
    // couldn't fetch yours". An empty value reads as authoritative and clobbers
    // the cached Complete/In progress badges in localStorage.
    //
    // Per-field rather than one response-level flag: a failure in an unrelated
    // section (solve stats, uploads) leaves the status map perfectly valid, and
    // discarding it there would strand a stale map for the rest of the session —
    // this effect doesn't re-run until its dependencies change or the component
    // remounts. Non-owners keep the empty defaults: not requested, not failed.
    let inProgress: Awaited<ReturnType<typeof getInProgressGames>> | undefined = [];
    let snapshotStatuses: Awaited<ReturnType<typeof getAuthenticatedPuzzleStatuses>> | undefined = {};
    let solvedPids: Awaited<ReturnType<typeof getSolvedPidsForUser>> | undefined;
    if (isOwner) {
      try {
        inProgress = await getInProgressGames(userId);
      } catch (err) {
        degradeOn('getInProgressGames', err);
        inProgress = undefined;
      }
      try {
        snapshotStatuses = await getAuthenticatedPuzzleStatuses(userId);
      } catch (err) {
        degradeOn('getAuthenticatedPuzzleStatuses', err);
        snapshotStatuses = undefined;
      }
      try {
        solvedPids = await getSolvedPidsForUser(userId);
      } catch (err) {
        degradeOn('getSolvedPidsForUser', err);
        // intentionally leave undefined — see note above
      }
    }

    // No stale-while-revalidate: this endpoint feeds the homepage in-progress
    // overlay and the profile, both of which need to reflect user actions
    // (dismiss, solve, rate) quickly. SWR=300 caused a 5-minute lag where a
    // just-dismissed game kept showing as in-progress. 30s is a compromise
    // between freshness and not refetching on every navigation.
    // On a degraded (statement-timeout) response, don't cache the empty stats —
    // the next request should get a fresh shot once the DB recovers.
    res.set('Cache-Control', isDegraded ? 'no-store' : 'private, max-age=30');
    res.json({
      // Cache-Control alone only stops HTTP caching. NewPuzzleList writes the
      // status map it derives from this response into localStorage, where a
      // partial profile would outlive the response and read as authoritative —
      // so the client needs to see the degradation, not just the cache layer.
      degraded: isDegraded || undefined,
      user: {
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      stats: {
        totalSolved,
        totalSolvedSolo,
        totalSolvedCoop,
        bySize,
        byDay,
        bySizeSolo,
        bySizeCoop,
        byDaySolo,
        byDayCoop,
      },
      history,
      uploads,
      inProgress,
      snapshotStatuses,
      solvedPids,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
