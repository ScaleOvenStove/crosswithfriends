import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {HealthResponseSchema} from './schemas.js';

/**
 * Health check endpoint for Docker and monitoring
 */
// eslint-disable-next-line require-await
async function healthRouter(fastify: FastifyInstance): Promise<void> {
  const options = {
    schema: {
      operationId: 'getHealth',
      tags: ['Health'],
      summary: 'Health check',
      description: 'Health check endpoint for Docker and monitoring',
      response: {
        200: HealthResponseSchema,
      },
    },
  };

  fastify.get('', options, (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}

export default healthRouter;
