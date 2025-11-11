import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import type {ListPuzzleResponse} from '@shared/types';
import {listPuzzles} from '../model/puzzle.js';
import type {ListPuzzleRequestFilters} from '@shared/types';
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

async function puzzleListRouter(fastify: FastifyInstance) {
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
      const puzzles = rawPuzzleList.map((puzzle) => ({
        pid: puzzle.pid,
        content: puzzle.content,
        stats: {numSolves: puzzle.times_solved},
      }));

      return {puzzles};
    }
  );
}

export default puzzleListRouter;
