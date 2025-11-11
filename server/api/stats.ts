import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {ListPuzzleStatsResponse, ListPuzzleStatsRequest} from '@shared/types';
import _ from 'lodash';
import {getPuzzleSolves} from '../model/puzzle_solve.js';
import type {SolvedPuzzleType} from '../model/puzzle_solve.js';
import {createHttpError} from './errors.js';

type PuzzleSummaryStat = {
  size: string;
  n_puzzles_solved: number;
  avg_solve_time: number;
  best_solve_time: number;
  best_solve_time_game: string;
  avg_revealed_square_count: number;
  avg_checked_square_count: number;
};

export function computePuzzleStats(puzzle_solves: SolvedPuzzleType[]): PuzzleSummaryStat[] {
  const groupedSizes = _.groupBy(puzzle_solves, (ps) => ps.size);
  const stats: PuzzleSummaryStat[] = [];
  Object.entries(groupedSizes).forEach(([size, sizePuzzles]) => {
    if (sizePuzzles.length === 0) {
      return;
    }
    const bestPuzzle = _.minBy(sizePuzzles, (p) => p.time_taken_to_solve);
    stats.push({
      size,
      n_puzzles_solved: sizePuzzles.length,
      avg_solve_time: _.mean(_.map(sizePuzzles, (p) => p.time_taken_to_solve)),
      best_solve_time_game: bestPuzzle!.gid,
      best_solve_time: bestPuzzle!.time_taken_to_solve,
      avg_revealed_square_count:
        Math.round(_.mean(_.map(sizePuzzles, (p) => p.revealed_squares_count)) * 100) / 100,
      avg_checked_square_count:
        Math.round(_.mean(_.map(sizePuzzles, (p) => p.checked_squares_count)) * 100) / 100,
    });
  });

  return stats.sort((a, b) => a.size.localeCompare(b.size));
}

async function statsRouter(fastify: FastifyInstance) {
  fastify.post<{Body: ListPuzzleStatsRequest; Reply: ListPuzzleStatsResponse}>(
    '/',
    async (request: FastifyRequest<{Body: ListPuzzleStatsRequest}>, _reply: FastifyReply) => {
      const {gids} = request.body;
      const startTime = Date.now();

      if (!Array.isArray(gids) || !_.every(gids, (it) => typeof it === 'string')) {
        throw createHttpError('gids are invalid', 400);
      }

      const puzzleSolves = await getPuzzleSolves(gids);
      const puzzleStats = computePuzzleStats(puzzleSolves);
      const stats = puzzleStats.map((stat) => ({
        size: stat.size,
        nPuzzlesSolved: stat.n_puzzles_solved,
        avgSolveTime: stat.avg_solve_time,
        bestSolveTime: stat.best_solve_time,
        bestSolveTimeGameId: stat.best_solve_time_game,
        avgCheckedSquareCount: stat.avg_checked_square_count,
        avgRevealedSquareCount: stat.avg_revealed_square_count,
      }));
      const history = puzzleSolves.map((solve) => {
        // Format date as YYYY-MM-DD
        const date = solve.solved_time;
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const dateSolved = `${year}-${month}-${day}`;

        return {
          puzzleId: solve.pid,
          gameId: solve.gid,
          title: solve.title,
          size: solve.size,
          dateSolved,
          solveTime: solve.time_taken_to_solve,
          checkedSquareCount: solve.checked_squares_count,
          revealedSquareCount: solve.revealed_squares_count,
        };
      });

      const ms = Date.now() - startTime;
      request.log.info({duration: ms, count: puzzleSolves.length}, 'overall /api/stats');

      return {
        stats,
        history,
      };
    }
  );
}

export default statsRouter;
