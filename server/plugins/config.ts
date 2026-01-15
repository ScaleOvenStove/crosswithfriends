/**
 * Config Plugin
 *
 * Decorates Fastify with the centralized config object.
 */

import type {FastifyInstance, FastifyPluginCallback} from 'fastify';
import fp from 'fastify-plugin';

import {config} from '../config/index.js';

const configPlugin: FastifyPluginCallback = (fastify: FastifyInstance): void => {
  fastify.decorate('config', config);
};

export default fp(configPlugin, {
  name: 'config',
});
