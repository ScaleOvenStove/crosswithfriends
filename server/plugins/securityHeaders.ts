/**
 * Security Headers Plugin
 *
 * Adds essential security headers to all HTTP responses.
 * These headers help prevent various attacks like XSS, clickjacking, MIME sniffing, etc.
 */

import type {FastifyInstance, FastifyPluginAsync} from 'fastify';
import fp from 'fastify-plugin';

import {config} from '../config/index.js';

interface SecurityHeadersOptions {
  /** Enable Content-Security-Policy header */
  contentSecurityPolicy?: boolean | string;
  /** Enable X-Frame-Options header */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** Enable X-Content-Type-Options header */
  noSniff?: boolean;
  /** Enable X-XSS-Protection header (legacy, but still useful for older browsers) */
  xssProtection?: boolean;
  /** Enable Referrer-Policy header */
  referrerPolicy?: string | false;
  /** Enable Strict-Transport-Security header */
  hsts?: boolean | {maxAge?: number; includeSubDomains?: boolean; preload?: boolean};
  /** Enable X-Download-Options header (IE-specific) */
  downloadOptions?: boolean;
  /** Enable X-Permitted-Cross-Domain-Policies header */
  crossDomainPolicies?: string | false;
  /** Enable Permissions-Policy header */
  permissionsPolicy?: string | false;
}

const defaultOptions: SecurityHeadersOptions = {
  contentSecurityPolicy: false, // API server doesn't need CSP (for HTML)
  frameOptions: 'DENY',
  noSniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  hsts: config.server.isProduction ? {maxAge: 31536000, includeSubDomains: true} : false,
  downloadOptions: true,
  crossDomainPolicies: 'none',
  permissionsPolicy: 'accelerometer=(), camera=(), geolocation=(), microphone=()',
};

/**
 * Builds HSTS header value from options
 */
function buildHstsHeader(options: {maxAge?: number; includeSubDomains?: boolean; preload?: boolean}): string {
  const parts = [`max-age=${options.maxAge || 31536000}`];
  if (options.includeSubDomains) {
    parts.push('includeSubDomains');
  }
  if (options.preload) {
    parts.push('preload');
  }
  return parts.join('; ');
}

const securityHeadersPlugin: FastifyPluginAsync<SecurityHeadersOptions> = async (
  fastify: FastifyInstance,
  opts: SecurityHeadersOptions
) => {
  const options = {...defaultOptions, ...opts};

  fastify.addHook('onSend', async (request, reply) => {
    // X-Content-Type-Options: Prevents MIME-type sniffing
    if (options.noSniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options: Prevents clickjacking by controlling framing
    if (options.frameOptions) {
      reply.header('X-Frame-Options', options.frameOptions);
    }

    // X-XSS-Protection: Legacy XSS protection for older browsers
    // Note: Modern browsers use CSP, but this helps with IE/older Edge
    if (options.xssProtection) {
      reply.header('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy: Controls how much referrer info is sent
    if (options.referrerPolicy) {
      reply.header('Referrer-Policy', options.referrerPolicy);
    }

    // Strict-Transport-Security: Enforces HTTPS
    // Only add in production to avoid issues with local development
    if (options.hsts && config.server.isProduction) {
      const hstsValue =
        typeof options.hsts === 'object'
          ? buildHstsHeader(options.hsts)
          : 'max-age=31536000; includeSubDomains';
      reply.header('Strict-Transport-Security', hstsValue);
    }

    // X-Download-Options: Prevents IE from executing downloads in site's context
    if (options.downloadOptions) {
      reply.header('X-Download-Options', 'noopen');
    }

    // X-Permitted-Cross-Domain-Policies: Controls Adobe Flash/PDF cross-domain access
    if (options.crossDomainPolicies) {
      reply.header('X-Permitted-Cross-Domain-Policies', options.crossDomainPolicies);
    }

    // Content-Security-Policy: CSP for protecting against XSS
    // For API servers, a minimal CSP is usually sufficient
    if (options.contentSecurityPolicy) {
      const cspValue =
        typeof options.contentSecurityPolicy === 'string'
          ? options.contentSecurityPolicy
          : "default-src 'none'; frame-ancestors 'none'";
      reply.header('Content-Security-Policy', cspValue);
    }

    // Permissions-Policy: Controls browser features
    if (options.permissionsPolicy) {
      reply.header('Permissions-Policy', options.permissionsPolicy);
    }

    // Cache-Control for API responses
    // Prevent caching of sensitive data by default for authenticated endpoints
    const authHeader = request.headers.authorization;
    if (authHeader && !reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
  });
};

// Export as a Fastify plugin without fastify-plugin wrapper (inline implementation)
export default securityHeadersPlugin;

// Also export for direct use without fp wrapper
export const securityHeaders = securityHeadersPlugin;

// Export types
export type {SecurityHeadersOptions};
