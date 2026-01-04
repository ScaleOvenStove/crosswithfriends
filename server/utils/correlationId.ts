/**
 * Request Correlation ID Utility
 *
 * Provides unique identifiers for tracing requests across services.
 * Correlation IDs help with:
 * - Debugging distributed systems
 * - Log aggregation and analysis
 * - Request tracing across microservices
 *
 * NOTE: For HTTP requests, Fastify's built-in request.id is used (configured via genReqId).
 * This module is kept for WebSocket connections that don't have Fastify's request context.
 */

import crypto from 'crypto';

// Standard header name for correlation ID (used by Fastify's requestIdHeader option)
export const CORRELATION_ID_HEADER = 'X-Request-ID';
export const CORRELATION_ID_HEADER_LOWER = 'x-request-id';

/**
 * Generates a new correlation ID using Node.js built-in crypto.randomUUID()
 * Returns a standard UUID v4 format
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts correlation ID from request headers (for WebSocket connections)
 * Falls back to generating a new ID if not present
 *
 * NOTE: For HTTP requests, use Fastify's built-in request.id instead.
 *
 * @param headers - Request headers object (can be undefined)
 * @returns The correlation ID (existing or newly generated)
 */
export function getOrCreateCorrelationId(
  headers: Record<string, string | string[] | undefined> | undefined | null
): string {
  if (!headers) {
    return generateCorrelationId();
  }

  // Try standard header first, then lowercase version
  const existing =
    headers[CORRELATION_ID_HEADER] ||
    headers[CORRELATION_ID_HEADER_LOWER] ||
    headers['X-Correlation-ID'] ||
    headers['x-correlation-id'];

  if (existing) {
    // Handle array (multiple headers with same name)
    const id = Array.isArray(existing) ? existing[0] : existing;
    // Validate: alphanumeric with hyphens, reasonable length
    if (id && /^[\w-]+$/.test(id) && id.length <= 100) {
      return id;
    }
  }

  return generateCorrelationId();
}

/**
 * Validates that a string is a valid correlation ID format
 */
export function isValidCorrelationId(id: string | undefined): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // Must be alphanumeric with hyphens/underscores, reasonable length
  return /^[\w-]+$/.test(id) && id.length >= 1 && id.length <= 100;
}
