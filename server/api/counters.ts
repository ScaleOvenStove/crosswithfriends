import type {IncrementGidResponse, IncrementPidResponse} from '@crosswithfriends/shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {incrementGid, incrementPid} from '../model/counters.js';

import {IncrementGidResponseSchema, IncrementPidResponseSchema, ErrorResponseSchema} from './schemas.js';

// eslint-disable-next-line require-await
async function countersRouter(fastify: FastifyInstance): Promise<void> {
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

  fastify.post<{Reply: IncrementGidResponse}>(
    '/gid',
    gidOptions,
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.debug('increment gid');
      const gid = await incrementGid();
      return {gid};
    }
  );

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

  fastify.post<{Reply: IncrementPidResponse}>(
    '/pid',
    pidOptions,
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.debug('increment pid');
      const pid = await incrementPid();
      return {pid};
    }
  );
}

export default countersRouter;
