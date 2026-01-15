import type {FastifyReply, FastifyRequest} from 'fastify';

import type {AppInstance} from '../types/fastify.js';

import type {HealthResponse} from './generated/index.js';
import {HealthResponseSchema} from './schemas.js';

/**
 * Health check endpoint for Docker and monitoring
 */
function healthRouter(fastify: AppInstance): void {
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

  fastify.get<{Reply: HealthResponse}>(
    '',
    options,
    (_request: FastifyRequest, _reply: FastifyReply): HealthResponse => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  );
}

export default healthRouter;
