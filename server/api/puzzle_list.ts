import type {ListPuzzleRequestFilters, ListPuzzleResponse} from '@shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {listPuzzles} from '../model/puzzle.js';

import {createHttpError} from './errors.js';

interface PuzzleListQuery {
  page: string;
  pageSize: string;
  filter?: {
    sizeFilter?: {
      Mini?: string;
      Standard?: string;
    };
    nameOrTitleFilter?: string;
  };
}

// eslint-disable-next-line require-await
async function puzzleListRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get<{Querystring: PuzzleListQuery; Reply: ListPuzzleResponse}>(
    '/',
    async (request: FastifyRequest<{Querystring: PuzzleListQuery}>, _reply: FastifyReply) => {
      const page = Number.parseInt(request.query.page, 10);
      const pageSize = Number.parseInt(request.query.pageSize, 10);

      if (!(Number.isFinite(page) && Number.isFinite(pageSize))) {
        throw createHttpError('page and pageSize should be integers', 400);
      }

      const rawFilters = request.query.filter;
      const filters: ListPuzzleRequestFilters = {
        sizeFilter: {
          Mini: rawFilters?.sizeFilter?.Mini === 'true',
          Standard: rawFilters?.sizeFilter?.Standard === 'true',
        },
        nameOrTitleFilter: (rawFilters?.nameOrTitleFilter ?? '') as string,
      };

      const rawPuzzleList = await listPuzzles(filters, pageSize, page * pageSize);
      const puzzles = rawPuzzleList.map((puzzle) => {
        // IMPORTANT: Production and staging share the same database.
        // Handle both old format (with info object) and ipuz format (title/author at root)
        const content = puzzle.content;

        // If content already has info object (old format), use it as-is
        if (content.info && typeof content.info === 'object') {
          return {
            pid: puzzle.pid,
            content,
            stats: {numSolves: puzzle.times_solved},
          };
        }

        // Otherwise, transform ipuz format to include info object for frontend compatibility
        // ipuz has title/author at root, but frontend expects content.info.title/author
        const solution = (content.solution || []) as (string | null)[][];
        const type = solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';

        // Create content with info object for frontend
        const contentWithInfo = {
          ...content,
          info: {
            type,
            title: (content.title as string | undefined) || '',
            author: (content.author as string | undefined) || '',
            copyright: (content.copyright as string | undefined) || '',
            description: (content.notes as string | undefined) || '',
          },
        };

        return {
          pid: puzzle.pid,
          content: contentWithInfo,
          stats: {numSolves: puzzle.times_solved},
        };
      });

      return {puzzles};
    }
  );
}

export default puzzleListRouter;
