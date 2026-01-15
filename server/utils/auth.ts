/**
 * Authentication Utilities
 *
 * Uses @fastify/jwt for token management in HTTP requests.
 * Provides standalone verification for WebSocket connections.
 *
 * JWT Configuration:
 * - Algorithm: HS256 (HMAC-SHA256)
 * - Token lifetime: 24 hours
 * - Requires AUTH_TOKEN_SECRET environment variable (minimum 32 characters in production)
 */

import crypto from 'crypto';

import {config} from '../config/index.js';
import type {AppInstance} from '../types/fastify.js';

import {logger} from './logger.js';

// Token configuration
export const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// Development secret (regenerated on each restart)
let devSecret: string | null = null;

/**
 * Gets the JWT secret from config or generates a development secret
 * @returns The JWT secret string
 */
export function getJwtSecret(): string {
  const secret = config.auth.tokenSecret;
  if (secret && secret.length >= 32) {
    return secret;
  }

  if (config.server.isProduction) {
    throw new Error(
      'AUTH_TOKEN_SECRET environment variable must be set in production (minimum 32 characters)'
    );
  }

  // In development, generate a random secret (tokens won't persist across restarts)
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
    logger.warn(
      'Using randomly generated AUTH_TOKEN_SECRET. Set AUTH_TOKEN_SECRET env var for persistent tokens.'
    );
  }
  return devSecret;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  iat?: number; // Issued at (added by @fastify/jwt)
  exp?: number; // Expires at (added by @fastify/jwt)
}

/**
 * Token payload for backward compatibility
 * Maps JWT standard claims to legacy format
 */
export interface TokenPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Fastify JWT configuration options
 * Used when registering @fastify/jwt plugin
 */
export function getJwtOptions(): {secret: string; sign: {expiresIn: string}} {
  return {
    secret: getJwtSecret(),
    sign: {
      expiresIn: `${TOKEN_EXPIRY_SECONDS}s`,
    },
  };
}

/**
 * Creates a signed JWT token using Fastify's jwt instance
 * @param fastify - Fastify instance with @fastify/jwt registered
 * @param userId - The user's unique identifier
 * @returns A signed JWT token string
 */
export function createAuthToken(fastify: AppInstance, userId: string): string {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('userId must be a non-empty string');
  }

  const payload: JwtPayload = {
    userId: userId.trim(),
  };

  return fastify.jwt.sign(payload);
}

/**
 * Verifies a JWT token using Fastify's jwt instance
 * @param fastify - Fastify instance with @fastify/jwt registered
 * @param token - The token string to verify
 * @returns The decoded payload if valid, null otherwise
 */
export function verifyAuthToken(fastify: AppInstance, token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = fastify.jwt.verify(token) as JwtPayload;

    if (!decoded.userId || typeof decoded.userId !== 'string') {
      logger.debug('Invalid token: missing userId');
      return null;
    }

    // Convert JWT standard claims to legacy format
    return {
      userId: decoded.userId,
      issuedAt: (decoded.iat || 0) * 1000, // Convert seconds to ms
      expiresAt: (decoded.exp || 0) * 1000, // Convert seconds to ms
    };
  } catch (error) {
    logger.debug({err: error}, 'JWT verification failed');
    return null;
  }
}

/**
 * Standalone JWT verification for WebSocket connections
 * Uses native crypto since Socket.IO doesn't have Fastify context
 *
 * NOTE: This is a simplified implementation for backward compatibility.
 * For HTTP requests, use fastify.jwt.verify() instead.
 *
 * @param token - JWT token string
 * @returns Decoded payload if valid, null otherwise
 */
export function verifyTokenStandalone(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }
    const secret = getJwtSecret();

    // Verify signature (HS256)
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

    if (signatureB64 !== expectedSignature) {
      logger.debug('Standalone token verification: signature mismatch');
      return null;
    }

    // Decode payload - payloadB64 is guaranteed to be string here due to check above
    const payloadJson = Buffer.from(payloadB64 as string, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as JwtPayload;

    if (!payload.userId || typeof payload.userId !== 'string') {
      logger.debug('Standalone token verification: missing userId');
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      logger.debug({userId: payload.userId}, 'Standalone token verification: expired');
      return null;
    }

    // Check not-before / issued-at with clock skew tolerance (60 seconds)
    if (payload.iat && payload.iat > now + 60) {
      logger.debug('Standalone token verification: issued in the future');
      return null;
    }

    return {
      userId: payload.userId,
      issuedAt: (payload.iat || 0) * 1000,
      expiresAt: (payload.exp || 0) * 1000,
    };
  } catch (error) {
    logger.debug({err: error}, 'Standalone token verification failed');
    return null;
  }
}

/**
 * Extracts token from Authorization header
 * Supports "Bearer <token>" format
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
    return parts[1] || null;
  }

  return null;
}

/**
 * Generates a cryptographically secure random user ID
 * @returns A random UUID v4 string
 */
export function generateSecureUserId(): string {
  return crypto.randomUUID();
}

/**
 * Validates that a user ID has a valid format
 * @param userId - User ID to validate
 * @returns true if valid format
 */
export function isValidUserIdFormat(userId: string | null | undefined): boolean {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  const trimmed = userId.trim();
  // Allow alphanumeric, hyphens, and underscores, 1-200 characters
  return trimmed.length > 0 && trimmed.length <= 200 && /^[\w-]+$/.test(trimmed);
}

// Fastify type augmentations handled by Fastify's built-in type system

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
