import type {AppInstance} from '../types/fastify.js';

import {HealthResponseSchema} from './schemas.js';

/**
 * Health check endpoint for Docker and monitoring
 */
// eslint-disable-next-line require-await
async function healthRouter(fastify: AppInstance): Promise<void> {
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

  fastify.get('', options, (_request: any, _reply: any) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}

export default healthRouter;
