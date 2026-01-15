import type {FastifyReply, FastifyRequest} from 'fastify';
import '../types/fastify.js';
import type {AppInstance} from '../types/fastify.js';

import type {RecordSolveRequest, RecordSolveResponse} from './generated/index.js';
import {RecordSolveRequestSchema, RecordSolveResponseSchema, ErrorResponseSchema} from './schemas.js';

// eslint-disable-next-line require-await
async function recordSolveRouter(fastify: AppInstance): Promise<void> {
  const postOptions = {
    schema: {
      operationId: 'recordPuzzleSolve',
      tags: ['Puzzles'],
      summary: 'Record puzzle solve',
      description: 'Records a completed puzzle solve with timing information',
      params: {
        type: 'object',
        required: ['pid'],
        properties: {
          pid: {type: 'string', description: 'Puzzle ID'},
        },
      },
      body: RecordSolveRequestSchema,
      response: {
        200: RecordSolveResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Params: {pid: string}; Body: RecordSolveRequest; Reply: RecordSolveResponse}>(
    '/:pid',
    postOptions,
    async (
      request: FastifyRequest<{Params: {pid: string}; Body: RecordSolveRequest}>,
      _reply: FastifyReply
    ): Promise<RecordSolveResponse> => {
      await fastify.repositories.puzzle.recordSolve(
        request.params.pid,
        request.body.gid,
        request.body.time_to_solve
      );
      return {};
    }
  );
}

export default recordSolveRouter;
