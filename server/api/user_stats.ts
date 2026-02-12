import express from 'express';
import {getUserSolveStats, getInProgressGames} from '../model/puzzle_solve';
import {getUserById} from '../model/user';
import {getUserUploadedPuzzles} from '../model/puzzle';

const router = express.Router();

router.get('/:userId', async (req, res, next) => {
  try {
    const {userId} = req.params;

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({error: 'User not found'});
      return;
    }

    const {totalSolved, bySize, history} = await getUserSolveStats(userId);

    let uploads: Awaited<ReturnType<typeof getUserUploadedPuzzles>> = [];
    try {
      uploads = await getUserUploadedPuzzles(userId);
    } catch (err) {
      console.error('getUserUploadedPuzzles error:', err);
    }

    let inProgress: Awaited<ReturnType<typeof getInProgressGames>> = [];
    try {
      inProgress = await getInProgressGames(userId);
    } catch (err) {
      console.error('getInProgressGames error:', err);
    }

    res.json({
      user: {
        displayName: user.display_name,
        createdAt: user.created_at,
      },
      stats: {totalSolved, bySize},
      history,
      uploads,
      inProgress,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
