/**
 * Type augmentations for Fastify custom decorators
 * These are added via plugins and app.decorate() in server.ts
 */

import type {
  FastifyInstance as FastifyInstanceBase,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  FastifyTypeProviderDefault,
} from 'fastify';

import type {Config} from '../config/index.js';
import type {DatabasePool} from '../model/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    repositories: import('../repositories/index.js').Repositories;
    services: import('../services/index.js').Services;
    db: DatabasePool;
    config: Config;
  }
}

// Type helper for FastifyInstance - use this instead of importing FastifyInstance directly
// This uses the default type parameters for Fastify v5
export type AppInstance = FastifyInstanceBase<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  FastifyTypeProviderDefault
>;
