/**
 * Database Plugin
 *
 * Manages PostgreSQL connection pool lifecycle:
 * - Creates pool on server start
 * - Decorates Fastify with `db` property
 * - Closes pool on server shutdown
 */

import type {FastifyInstance, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

import {closePool, createPool} from '../model/pool.js';
import {logger} from '../utils/logger.js';

/**
 * Database plugin implementation
 */
const databasePlugin: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Create the database pool
  const pool = createPool(fastify.config);

  logger.info('Database connection pool created');

  // Decorate Fastify with the pool
  fastify.decorate('db', pool);

  // Register shutdown hook to close the pool gracefully
  fastify.addHook('onClose', async (): Promise<void> => {
    logger.info('Closing database connection pool');
    await closePool(pool);
    logger.info('Database connection pool closed');
  });
};

// Wrap with fastify-plugin to avoid encapsulation
// This makes the `db` decorator available to all routes
export default fp(databasePlugin, {
  name: 'database',
  dependencies: ['config'], // Requires config to be decorated first
});
