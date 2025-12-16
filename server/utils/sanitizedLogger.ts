/**
 * Sanitized Logging Utility
 * Provides consistent header sanitization across all endpoints
 */

import type {FastifyRequest} from 'fastify';

/**
 * Sensitive header keys that should be redacted in logs
 */
const SENSITIVE_HEADER_KEYS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'];

/**
 * Sanitizes request headers by redacting sensitive fields
 * @param headers - Request headers object
 * @returns Sanitized headers object with sensitive fields redacted
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const sanitized: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Creates a safe body summary for logging (logs keys and size instead of full payload)
 * @param body - Request body object
 * @returns Safe body summary object
 */
export function createBodySummary(body: unknown): {keys: string[]; size: number} {
  if (!body || typeof body !== 'object') {
    return {keys: [], size: 0};
  }

  return {
    keys: Object.keys(body),
    size: JSON.stringify(body).length,
  };
}

/**
 * Logs a request with sanitized headers and safe body summary
 * @param request - Fastify request object
 * @param message - Optional log message
 */
export function logRequest(request: FastifyRequest, message = 'got req'): void {
  request.log.debug(
    {
      method: request.method,
      url: request.url,
      id: request.id,
      headers: sanitizeHeaders(request.headers),
      body: createBodySummary(request.body),
      params: request.params,
      query: request.query,
    },
    message
  );
}
