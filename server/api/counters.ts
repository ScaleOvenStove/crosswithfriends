import type {IncrementGidResponse, IncrementPidResponse} from '@shared/types';
import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {incrementGid, incrementPid} from '../model/counters.js';

// eslint-disable-next-line require-await
async function countersRouter(fastify: FastifyInstance): Promise<void> {
  fastify.post<{Reply: IncrementGidResponse}>(
    '/gid',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.debug('increment gid');
      const gid = await incrementGid();
      return {gid};
    }
  );

  fastify.post<{Reply: IncrementPidResponse}>(
    '/pid',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      request.log.debug('increment pid');
      const pid = await incrementPid();
      return {pid};
    }
  );
}

export default countersRouter;
