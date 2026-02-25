import express from 'express';
import {getUserSolveStats, getInProgressGames} from '../model/puzzle_solve';
import {getUserById} from '../model/user';
import {getUserUploadedPuzzles} from '../model/puzzle';
import {verifyAccessToken} from '../auth/jwt';

const router = express.Router();

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

    const {totalSolved, bySize, byDay, history} = await getUserSolveStats(userId);

    let uploads: Awaited<ReturnType<typeof getUserUploadedPuzzles>> = [];
    try {
      uploads = await getUserUploadedPuzzles(userId);
    } catch (err) {
      console.error('getUserUploadedPuzzles error:', err);
    }

    let inProgress: Awaited<ReturnType<typeof getInProgressGames>> = [];
    if (isOwner) {
      try {
        inProgress = await getInProgressGames(userId);
      } catch (err) {
        console.error('getInProgressGames error:', err);
      }
    }

    res.json({
      user: {
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      stats: {totalSolved, bySize, byDay},
      history,
      uploads,
      inProgress,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
