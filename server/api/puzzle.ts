import type {AddPuzzleRequest, AddPuzzleResponse, PuzzleJson} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {addPuzzle, getPuzzle} from '../model/puzzle.js';

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
      // Sanitize headers: redact sensitive fields
      const sanitizedHeaders: Record<string, string | string[] | undefined> = {};
      const sensitiveHeaderKeys = ['authorization', 'cookie', 'set-cookie'];
      for (const [key, value] of Object.entries(request.headers)) {
        if (sensitiveHeaderKeys.includes(key.toLowerCase())) {
          sanitizedHeaders[key] = '[REDACTED]';
        } else {
          sanitizedHeaders[key] = value;
        }
      }

      // Create safe body summary: log keys and size instead of full payload
      const bodySummary = {
        keys: Object.keys(request.body || {}),
        size: JSON.stringify(request.body || {}).length,
      };

      request.log.debug(
        {
          method: request.method,
          url: request.url,
          id: request.id,
          headers: sanitizedHeaders,
          body: bodySummary,
        },
        'got req'
      );
      const pid = await addPuzzle(request.body.puzzle, request.body.isPublic, request.body.pid);
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
      request.log.debug({headers: request.headers, params: request.params}, 'got req');
      const {pid} = request.params;

      try {
        const puzzle = await getPuzzle(pid);
        return puzzle;
      } catch (error) {
        request.log.error(error, `Failed to get puzzle ${pid}`);
        throw createHttpError('Puzzle not found', 404);
      }
    }
  );
}

export default puzzleRouter;
