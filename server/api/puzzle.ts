import type {AddPuzzleRequest, AddPuzzleResponse, PuzzleJson} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {validatePuzzleId} from '../utils/inputValidation.js';
import {logRequest} from '../utils/sanitizedLogger.js';

import {createHttpError} from './errors.js';
import {
  AddPuzzleRequestSchema,
  AddPuzzleResponseSchema,
  PuzzleJsonSchema,
  ErrorResponseSchema,
} from './schemas.js';

// eslint-disable-next-line require-await
async function puzzleRouter(fastify: FastifyInstance): Promise<void> {
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

  fastify.post<{Body: AddPuzzleRequest; Reply: AddPuzzleResponse}>(
    '',
    postOptions,
    async (request: FastifyRequest<{Body: AddPuzzleRequest}>, _reply: FastifyReply) => {
      logRequest(request);

      // Validate puzzle ID format if provided
      if (request.body.pid) {
        const pidValidation = validatePuzzleId(request.body.pid);
        if (!pidValidation.valid) {
          throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
        }
      }

      const pid = await fastify.repositories.puzzle.create(
        request.body.pid || '',
        request.body.puzzle,
        request.body.isPublic
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
    async (request: FastifyRequest<{Params: {pid: string}}>, _reply: FastifyReply) => {
      logRequest(request);
      const {pid} = request.params;

      // Validate puzzle ID format
      const pidValidation = validatePuzzleId(pid);
      if (!pidValidation.valid) {
        throw createHttpError(pidValidation.error || 'Invalid puzzle ID', 400);
      }

      try {
        const puzzle = await fastify.repositories.puzzle.findById(pidValidation.value!);
        return puzzle;
      } catch (error) {
        request.log.error(error, `Failed to get puzzle ${pidValidation.value}`);
        throw createHttpError('Puzzle not found', 404);
      }
    }
  );
}

export default puzzleRouter;
