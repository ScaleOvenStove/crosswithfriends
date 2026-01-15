import type {PuzzleJson} from '@crosswithfriends/shared/types';
import type {FastifyReply, FastifyRequest} from 'fastify';

import '../types/fastify.js';
import {convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import type {AppInstance} from '../types/fastify.js';
import {validatePuzzleId} from '../utils/inputValidation.js';
import {logRequest} from '../utils/sanitizedLogger.js';

import {createHttpError} from './errors.js';
import type {CreatePuzzleResponse} from './generated/index.js';
import {
  AddPuzzleRequestSchema,
  AddPuzzleResponseSchema,
  PuzzleJsonSchema,
  ErrorResponseSchema,
} from './schemas.js';

// eslint-disable-next-line require-await
async function puzzleRouter(fastify: AppInstance): Promise<void> {
  interface CreatePuzzleBody {
    pid?: string;
    puzzle: PuzzleJson;
    isPublic?: boolean;
  }
  const postOptions = {
    schema: {
      operationId: 'createPuzzle',
      tags: ['Puzzles'],
      summary: 'Add a new puzzle',
      description: 'Adds a new puzzle to the system. If pid is not provided, the backend generates one.',
      body: AddPuzzleRequestSchema,
      response: {
        200: AddPuzzleResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Body: CreatePuzzleBody; Reply: CreatePuzzleResponse}>(
    '',
    postOptions,
    async (
      request: FastifyRequest<{Body: CreatePuzzleBody}>,
      _reply: FastifyReply
    ): Promise<CreatePuzzleResponse> => {
      logRequest(request);

      // Validate puzzle ID format if provided
      if (request.body.pid) {
        const pidValidation = validatePuzzleId(request.body.pid);
        if (!pidValidation.valid) {
          throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
        }
      }

      const puzzle = convertOldFormatToIpuz(request.body.puzzle);
      const pid = await fastify.repositories.puzzle.create(
        request.body.pid || '',
        puzzle,
        request.body.isPublic ?? false
      );
      return {pid};
    }
  );

  const getOptions = {
    schema: {
      operationId: 'getPuzzleById',
      tags: ['Puzzles'],
      summary: 'Get puzzle by ID',
      description: 'Retrieves full puzzle data including grid, clues, and solution',
      params: {
        type: 'object',
        required: ['pid'],
        properties: {
          pid: {type: 'string', description: 'Puzzle ID'},
        },
      },
      response: {
        200: PuzzleJsonSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.get<{Params: {pid: string}; Reply: PuzzleJson}>(
    '/:pid',
    getOptions,
    async (request: FastifyRequest<{Params: {pid: string}}>, _reply: FastifyReply): Promise<PuzzleJson> => {
      logRequest(request);
      const {pid} = request.params;

      // Validate puzzle ID format
      const pidValidation = validatePuzzleId(pid);
      const pidValue = pidValidation.value;
      if (!pidValidation.valid || !pidValue) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      try {
        const puzzle = await fastify.repositories.puzzle.findById(pidValue);
        return puzzle;
      } catch (error) {
        request.log.error(error, `Failed to get puzzle ${pidValue}`);
        throw createHttpError('Puzzle not found', 404);
      }
    }
  );
}

export default puzzleRouter;
