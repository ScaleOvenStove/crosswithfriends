/**
 * Fastify Correlation ID Plugin
 *
 * Adds correlation IDs to response headers for client tracking.
 * Uses Fastify's built-in request.id (configured via genReqId option in server.ts).
 *
 * Fastify's request.id is already:
 * - Automatically generated or extracted from requestIdHeader
 * - Included in Pino logs as 'reqId'
 *
 * This plugin:
 * - Exposes request.id as request.correlationId for backward compatibility
 * - Adds the ID to response headers for client-side tracking
 */

import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';

import {CORRELATION_ID_HEADER} from '../utils/correlationId.js';

// Extend FastifyRequest to include correlationId alias
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

export function correlationIdPlugin(fastify: FastifyInstance): void {
  // Add correlation ID to every request
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    // Use Fastify's built-in request.id (already generated via genReqId option)
    const correlationId = request.id;

    request.correlationId = correlationId;

    // Add to response headers for client tracking
    reply.header(CORRELATION_ID_HEADER, correlationId);
    done();
  });
}

export default correlationIdPlugin;
