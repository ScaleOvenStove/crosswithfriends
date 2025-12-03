import type {RecordSolveRequest, RecordSolveResponse} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {recordSolve} from '../model/puzzle.js';

import {RecordSolveRequestSchema, RecordSolveResponseSchema, ErrorResponseSchema} from './schemas.js';

// eslint-disable-next-line require-await
async function recordSolveRouter(fastify: FastifyInstance): Promise<void> {
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
    ) => {
      await recordSolve(request.params.pid, request.body.gid, request.body.time_to_solve);
      return {};
    }
  );
}

export default recordSolveRouter;
