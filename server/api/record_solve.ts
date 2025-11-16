import type {RecordSolveRequest, RecordSolveResponse} from '@shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {recordSolve} from '../model/puzzle.js';

// eslint-disable-next-line require-await
async function recordSolveRouter(fastify: FastifyInstance) {
  fastify.post<{Params: {pid: string}; Body: RecordSolveRequest; Reply: RecordSolveResponse}>(
    '/:pid',
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
