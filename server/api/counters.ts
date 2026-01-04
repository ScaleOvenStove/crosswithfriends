import '../types/fastify.js';
import type {AppInstance} from '../types/fastify.js';

import type {IncrementGidResponse, IncrementPidResponse} from './generated/index.js';
import {IncrementGidResponseSchema, IncrementPidResponseSchema, ErrorResponseSchema} from './schemas.js';

// eslint-disable-next-line require-await
async function countersRouter(fastify: AppInstance): Promise<void> {
  const gidOptions = {
    schema: {
      operationId: 'getNewGameId',
      tags: ['Counters'],
      summary: 'Increment and get a new game ID',
      description: 'Increments the game ID counter and returns the new game ID',
      response: {
        200: IncrementGidResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Reply: IncrementGidResponse}>('/gid', gidOptions, async (request: any, _reply: any) => {
    request.log.debug('increment gid');
    const gid = await fastify.repositories.counters.getNextGameId();
    return {gid};
  });

  const pidOptions = {
    schema: {
      operationId: 'getNewPuzzleId',
      tags: ['Counters'],
      summary: 'Increment and get a new puzzle ID',
      description: 'Increments the puzzle ID counter and returns the new puzzle ID',
      response: {
        200: IncrementPidResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  };

  fastify.post<{Reply: IncrementPidResponse}>('/pid', pidOptions, async (request: any, _reply: any) => {
    request.log.debug('increment pid');
    const pid = await fastify.repositories.counters.getNextPuzzleId();
    return {pid};
  });
}

export default countersRouter;
