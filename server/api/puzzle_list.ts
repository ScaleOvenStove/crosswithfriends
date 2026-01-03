import type {ListPuzzleRequestFilters, ListPuzzleResponse, PuzzleJson} from '@crosswithfriends/shared/types';

import '../types/fastify.js';
import type {AppInstance} from '../types/fastify.js';
import {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';

import {createHttpError} from './errors.js';
import {ErrorResponseSchema} from './schemas.js';

interface PuzzleListQuery {
  page: string;
  pageSize: string;
  sizeMini?: string;
  sizeStandard?: string;
  nameOrTitle?: string;
}

// eslint-disable-next-line require-await
async function puzzleListRouter(fastify: AppInstance): Promise<void> {
  const getOptions = {
    schema: {
      operationId: 'listPuzzles',
      tags: ['Puzzles'],
      summary: 'List puzzles',
      description: 'Get a paginated list of puzzles with optional filters',
      querystring: {
        type: 'object',
        required: ['page', 'pageSize'],
        properties: {
          page: {type: 'string', description: 'Page number'},
          pageSize: {type: 'string', description: 'Number of items per page'},
          sizeMini: {type: 'string', description: 'Filter for mini puzzles (true/false)'},
          sizeStandard: {type: 'string', description: 'Filter for standard puzzles (true/false)'},
          nameOrTitle: {type: 'string', description: 'Filter by name or title'},
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            puzzles: {
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

  fastify.get<{Querystring: PuzzleListQuery; Reply: ListPuzzleResponse}>(
    '',
    getOptions,
    async (request: any, _reply: any) => {
      const page = Number.parseInt(request.query.page, 10);
      const pageSize = Number.parseInt(request.query.pageSize, 10);

      if (!(Number.isFinite(page) && Number.isFinite(pageSize))) {
        throw createHttpError('page and pageSize should be integers', 400);
      }

      // Handle undefined string values from frontend (should be treated as missing)
      const sizeMini = request.query.sizeMini;
      const sizeStandard = request.query.sizeStandard;
      const filters: ListPuzzleRequestFilters = {
        sizeFilter: {
          Mini: sizeMini === 'true' && typeof sizeMini === 'string',
          Standard: sizeStandard === 'true' && typeof sizeStandard === 'string',
        },
        nameOrTitleFilter: (request.query.nameOrTitle ?? '') as string,
      };

      const result = await fastify.repositories.puzzle.list(filters, pageSize, page * pageSize);
      const rawPuzzleList = result.puzzles;

      const puzzles = rawPuzzleList.map(
        (puzzle: {
          pid: string;
          puzzle: PuzzleJson;
        }): {
          pid: string;
          content: PuzzleJson;
          stats: {numSolves: number};
        } => {
          // Convert old format to ipuz format for consistency
          // All puzzles returned to clients are now in pure ipuz format
          const content = convertOldFormatToIpuz(puzzle.puzzle);
          return {
            pid: puzzle.pid,
            content,
            stats: {numSolves: 0}, // TODO: Add numSolves to repository response
          };
        }
      );

      return {puzzles};
    }
  );
}

export default puzzleListRouter;
