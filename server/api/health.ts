import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

/**
 * Health check endpoint for Docker and monitoring
 */
// eslint-disable-next-line require-await
async function healthRouter(fastify: FastifyInstance) {
  fastify.get('/', (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}

export default healthRouter;
