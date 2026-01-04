/**
 * Type augmentations for Fastify custom decorators
 * These are added via app.decorate() in server.ts
 */

import type {
  FastifyInstance as FastifyInstanceBase,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  FastifyTypeProviderDefault,
} from 'fastify';

declare module 'fastify' {
  interface FastifyInstance<
    _RawServer extends import('fastify').RawServerBase = RawServerDefault,
    _RawRequest extends import('fastify').RawRequestDefaultExpression<_RawServer> =
      RawRequestDefaultExpression<_RawServer>,
    _RawReply extends import('fastify').RawReplyDefaultExpression<_RawServer> =
      RawReplyDefaultExpression<_RawServer>,
    _Logger extends import('fastify').FastifyBaseLogger = FastifyBaseLogger,
    _TypeProvider extends import('fastify').FastifyTypeProvider = FastifyTypeProviderDefault,
  > {
    repositories: import('../repositories/index.js').Repositories;
    services: import('../services/index.js').Services;
    pool: import('pg').Pool;
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
