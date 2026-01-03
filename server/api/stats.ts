import type {ListPuzzleStatsRequest, ListPuzzleStatsResponse} from '@crosswithfriends/shared/types';

import type {SolvedPuzzleType} from '../model/puzzle_solve.js';
import {getPuzzleSolves} from '../model/puzzle_solve.js';
import type {AppInstance} from '../types/fastify.js';

import {createHttpError} from './errors.js';
import {ListPuzzleStatsRequestSchema, ErrorResponseSchema} from './schemas.js';

const groupBy = <T>(arr: T[], fn: (item: T) => string | number): Record<string, T[]> => {
  return arr.reduce(
    (acc, item) => {
      const key = String(fn(item));
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
};

const mean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

const minBy = <T>(arr: T[], fn: (item: T) => number): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr.reduce((min, item) => (fn(item) < fn(min) ? item : min));
};

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
  const groupedSizes = groupBy(puzzle_solves, (ps) => ps.size);
  const stats: PuzzleSummaryStat[] = [];
  Object.entries(groupedSizes).forEach(([size, sizePuzzles]) => {
    if (sizePuzzles.length === 0) {
      return;
    }
    const bestPuzzle = minBy(sizePuzzles, (p) => p.time_taken_to_solve);
    if (!bestPuzzle) {
      return;
    }
    stats.push({
      size,
      n_puzzles_solved: sizePuzzles.length,
      avg_solve_time: mean(sizePuzzles.map((p) => p.time_taken_to_solve)),
      best_solve_time_game: bestPuzzle.gid,
      best_solve_time: bestPuzzle.time_taken_to_solve,
      avg_revealed_square_count:
        Math.round(mean(sizePuzzles.map((p) => p.revealed_squares_count)) * 100) / 100,
      avg_checked_square_count: Math.round(mean(sizePuzzles.map((p) => p.checked_squares_count)) * 100) / 100,
    });
  });

  return stats.sort((a, b) => a.size.localeCompare(b.size));
}

// eslint-disable-next-line require-await
async function statsRouter(fastify: AppInstance): Promise<void> {
  const postOptions = {
    schema: {
      operationId: 'submitStats',
      tags: ['Stats'],
      summary: 'Get puzzle statistics',
      description: 'Retrieves aggregated statistics and history for given game IDs',
      body: ListPuzzleStatsRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            stats: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
            },
            history: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: ListPuzzleStatsRequest; Reply: ListPuzzleStatsResponse}>(
    '',
    postOptions,
    async (request: any, _reply: any) => {
      const {gids} = request.body;
      const startTime = Date.now();

      if (!Array.isArray(gids) || !gids.every((it) => typeof it === 'string')) {
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
