/**
 * Config Plugin
 *
 * Decorates Fastify with the centralized config object.
 */

import type {FastifyInstance, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

import {config} from '../config/index.js';

const configPlugin: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorate('config', config);
};

export default fp(configPlugin, {
  name: 'config',
});
