import express from 'express';
import puzzleListRouter from './puzzle_list';
import puzzleRouter from './puzzle';
import gameRouter from './game';
import recordSolveRouter from './record_solve';
import oEmbedRouter from './oembed';
import linkPreviewRouter from './link_preview';
import countersRouter from './counters';
import authRouter from './auth';
import userStatsRouter from './user_stats';
import gameSnapshotRouter from './game_snapshot';
import gameProgressRouter from './game_progress';
import userGamesRouter from './user_games';
import healthRouter from './health';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/puzzle_list', puzzleListRouter);
router.use('/puzzle', puzzleRouter);
router.use('/game', gameRouter);
router.use('/record_solve', recordSolveRouter);
router.use('/user-stats', userStatsRouter);
router.use('/user-games', userGamesRouter);
router.use('/game-snapshot', gameSnapshotRouter);
router.use('/game-progress', gameProgressRouter);
router.use('/oembed', oEmbedRouter);
router.use('/link_preview', linkPreviewRouter);
router.use('/counters', countersRouter);
router.use('/health', healthRouter);

export default router;
