/**
 * User Authentication Utilities
 *
 * Provides secure user ID extraction and validation using JWT-based auth.
 *
 * For HTTP requests: Uses @fastify/jwt via request.jwtVerify()
 * For WebSocket: Uses standalone JWT verification (verifyTokenStandalone)
 */

import type {Socket} from 'socket.io';

import {config} from '../config/index.js';

import {
  extractTokenFromHeader,
  isValidUserIdFormat,
  verifyTokenStandalone,
  type TokenPayload,
} from './auth.js';
import {logger} from './logger.js';
import {isInsecureModeAllowed} from './securityValidation.js';
import {hasUserId} from './typeGuards.js';

/**
 * Result of authentication attempt
 */
export interface AuthResult {
  authenticated: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Extracts and validates user from Socket.IO handshake using token-based auth
 * Supports extraction from:
 * - Auth token in auth.token
 * - Auth token in query.token (for backward compatibility)
 * - Legacy: query.userId or auth.userId (only in development with REQUIRE_AUTH=false)
 * @param socket - Socket.IO socket instance
 * @returns AuthResult with user ID if authenticated
 */
export function extractUserIdFromSocket(socket: Socket): string | null {
  const authResult = authenticateSocket(socket);
  return authResult.authenticated ? authResult.userId : null;
}

/**
 * Full authentication for Socket.IO connections
 * @param socket - Socket.IO socket instance
 * @returns AuthResult with authentication status and user ID
 */
export function authenticateSocket(socket: Socket): AuthResult {
  if (!socket.handshake) {
    return {authenticated: false, userId: null, error: 'No handshake data'};
  }

  // Try token from auth object first (preferred method)
  // Uses standalone verification since Socket.IO doesn't have Fastify context
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    const payload = verifyTokenStandalone(authToken.trim());
    if (payload) {
      return {authenticated: true, userId: payload.userId};
    }
    logger.debug('Socket auth token verification failed');
  }

  // Try token from query parameter (backward compatibility)
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    const payload = verifyTokenStandalone(queryToken.trim());
    if (payload) {
      return {authenticated: true, userId: payload.userId};
    }
    logger.debug('Socket query token verification failed');
  }

  // Legacy support: userId directly (only in development mode without required auth)
  // SECURITY: Use centralized check to prevent bypass in production
  if (isInsecureModeAllowed()) {
    const legacyUserId = extractLegacyUserIdFromSocket(socket);
    if (legacyUserId && isValidUserIdFormat(legacyUserId)) {
      logger.debug({userId: legacyUserId}, 'Using legacy userId auth (development mode only)');
      return {authenticated: true, userId: legacyUserId};
    }
  }

  return {
    authenticated: false,
    userId: null,
    error: config.auth.requireAuth
      ? 'Valid authentication token required'
      : 'No valid authentication provided',
  };
}

/**
 * Legacy extraction of userId from socket (for backward compatibility in dev)
 */
function extractLegacyUserIdFromSocket(socket: Socket): string | null {
  // Try query parameter
  if (socket.handshake.query) {
    const userId = socket.handshake.query.userId;
    if (typeof userId === 'string' && userId.trim()) {
      return userId.trim();
    }
  }

  // Try auth object
  const auth = socket.handshake.auth;
  if (auth && typeof auth.userId === 'string' && auth.userId.trim()) {
    return auth.userId.trim();
  }

  return null;
}

/**
 * Validates that a user ID is present and has valid format
 * @param userId - User ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidUserId(userId: string | null | undefined): boolean {
  return isValidUserIdFormat(userId);
}

/**
 * Request interface for authentication
 */
interface AuthenticatableRequest {
  query?: {userId?: string; token?: string};
  headers?: {[key: string]: string | string[] | undefined};
  body?: Record<string, unknown>;
}

/**
 * Extracts and validates user from Fastify request using token-based auth
 * Supports extraction from:
 * - Authorization header: "Bearer <token>" (backend JWT)
 * - Query parameter: ?token=xxx (backend JWT)
 * - Legacy: ?userId=xxx, X-User-Id header (only in development with REQUIRE_AUTH=false)
 * @param request - Fastify request object
 * @returns User ID string or null if not authenticated
 */
export function extractUserIdFromRequest(request: AuthenticatableRequest): string | null {
  const authResult = authenticateRequest(request);
  return authResult.authenticated ? authResult.userId : null;
}

/**
 * Full authentication for HTTP requests
 * Verifies backend JWT tokens (created via /api/auth/token or /api/auth/firebase-token)
 *
 * NOTE: For Fastify routes, prefer using request.jwtVerify() from @fastify/jwt.
 * This function is kept for contexts where Fastify request isn't available.
 *
 * @param request - Request object with headers, query, body
 * @returns AuthResult with authentication status and user ID
 */
export function authenticateRequest(request: AuthenticatableRequest): AuthResult {
  // Try Authorization header first (preferred method)
  const authHeader = request.headers?.authorization || request.headers?.['Authorization'];
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const headerToken = extractTokenFromHeader(headerValue);

  if (headerToken) {
    // Verify backend JWT token
    const payload = verifyTokenStandalone(headerToken);
    if (payload) {
      return {authenticated: true, userId: payload.userId};
    }
    logger.debug('Authorization header token verification failed');
  }

  // Try token from query parameter
  if (request.query?.token && typeof request.query.token === 'string') {
    const payload = verifyTokenStandalone(request.query.token.trim());
    if (payload) {
      return {authenticated: true, userId: payload.userId};
    }
    logger.debug('Query token verification failed');
  }

  // Legacy support: userId directly (only in development mode without required auth)
  // SECURITY: Use centralized check to prevent bypass in production
  if (isInsecureModeAllowed()) {
    const legacyUserId = extractLegacyUserIdFromRequest(request);
    if (legacyUserId && isValidUserIdFormat(legacyUserId)) {
      logger.debug({userId: legacyUserId}, 'Using legacy userId auth (development mode only)');
      return {authenticated: true, userId: legacyUserId};
    }
  }

  return {
    authenticated: false,
    userId: null,
    error: config.auth.requireAuth
      ? 'Valid authentication token required. Use Authorization: Bearer <token>'
      : 'No valid authentication provided',
  };
}

/**
 * Legacy extraction of userId from request (for backward compatibility in dev)
 */
function extractLegacyUserIdFromRequest(request: AuthenticatableRequest): string | null {
  // Try query parameter
  if (request.query?.userId && typeof request.query.userId === 'string') {
    const userId = request.query.userId.trim();
    if (userId) return userId;
  }

  // Try header
  const headerUserId = request.headers?.['x-user-id'];
  if (headerUserId) {
    const userId = typeof headerUserId === 'string' ? headerUserId : headerUserId[0];
    if (userId && typeof userId === 'string') {
      const trimmed = userId.trim();
      if (trimmed) return trimmed;
    }
  }

  // Try body (for POST requests)
  if (request.body && hasUserId(request.body)) {
    const trimmed = request.body.userId.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

/**
 * Gets the token payload if the request is authenticated
 * Useful for getting additional token metadata like expiry
 *
 * NOTE: For Fastify routes, prefer using request.user from @fastify/jwt.
 */
export function getTokenPayload(request: AuthenticatableRequest): TokenPayload | null {
  // Try Authorization header
  const authHeader = request.headers?.authorization || request.headers?.['Authorization'];
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const headerToken = extractTokenFromHeader(headerValue);

  if (headerToken) {
    return verifyTokenStandalone(headerToken);
  }

  // Try query token
  if (request.query?.token && typeof request.query.token === 'string') {
    return verifyTokenStandalone(request.query.token.trim());
  }

  return null;
}

/**
 * Authorization result with additional context
 */
export interface AuthorizationResult {
  authorized: boolean;
  reason: 'owner' | 'participant' | 'not_found' | 'denied' | 'invalid_user';
}

/**
 * Checks if a user is authorized to access a specific game
 * @param userId - User ID to check
 * @param gid - Game ID
 * @param getGameCreator - Function to get the game creator's user ID
 * @param checkGameExists - Optional function to verify game exists (returns true if exists)
 * @returns Promise resolving to authorization result
 */
export async function isUserAuthorizedForGame(
  userId: string,
  gid: string,
  getGameCreator: (gid: string) => Promise<string | null>,
  checkGameExists?: (gid: string) => Promise<boolean>
): Promise<AuthorizationResult> {
  if (!isValidUserId(userId)) {
    return {authorized: false, reason: 'invalid_user'};
  }

  // Get the game creator
  const creatorId = await getGameCreator(gid);

  // If no creator found, check if game exists at all
  if (!creatorId) {
    // If we have a checkGameExists function, use it
    if (checkGameExists) {
      const exists = await checkGameExists(gid);
      if (!exists) {
        logger.debug({gid}, 'Game not found');
        return {authorized: false, reason: 'not_found'};
      }
      // Game exists but has no creator - this is a legacy game or public game
      // Allow access as a participant (backward compatibility)
      logger.debug({gid, userId}, 'Game exists but no creator, allowing as participant');
      return {authorized: true, reason: 'participant'};
    }

    // SECURITY: Default to deny if we can't verify game existence
    // This prevents access to potentially non-existent or unauthorized resources
    logger.debug({gid}, 'No creator found for game and cannot verify existence, denying access');
    return {authorized: false, reason: 'not_found'};
  }

  // Game creator always has access
  if (creatorId === userId) {
    return {authorized: true, reason: 'owner'};
  }

  // For collaborative games, allow any authenticated user as a participant
  // Games in this app are inherently collaborative (crossword puzzles with friends)
  return {authorized: true, reason: 'participant'};
}

/**
 * Checks if a user is authorized to access a specific room
 * @param userId - User ID to check
 * @param rid - Room ID
 * @param getRoomCreator - Function to get the room creator's user ID
 * @param checkRoomExists - Optional function to verify room exists (returns true if exists)
 * @returns Promise resolving to authorization result
 */
export async function isUserAuthorizedForRoom(
  userId: string,
  rid: string,
  getRoomCreator: (rid: string) => Promise<string | null>,
  checkRoomExists?: (rid: string) => Promise<boolean>
): Promise<AuthorizationResult> {
  if (!isValidUserId(userId)) {
    return {authorized: false, reason: 'invalid_user'};
  }

  // Get the room creator
  const creatorId = await getRoomCreator(rid);

  // If no creator found, check if room exists at all
  if (!creatorId) {
    // If we have a checkRoomExists function, use it
    if (checkRoomExists) {
      const exists = await checkRoomExists(rid);
      if (!exists) {
        logger.debug({rid}, 'Room not found');
        return {authorized: false, reason: 'not_found'};
      }
      // Room exists but has no creator - this is a legacy room or public room
      // Allow access as a participant (backward compatibility)
      logger.debug({rid, userId}, 'Room exists but no creator, allowing as participant');
      return {authorized: true, reason: 'participant'};
    }

    // SECURITY: Default to deny if we can't verify room existence
    // This prevents access to potentially non-existent or unauthorized resources
    logger.debug({rid}, 'No creator found for room and cannot verify existence, denying access');
    return {authorized: false, reason: 'not_found'};
  }

  // Room creator always has access
  if (creatorId === userId) {
    return {authorized: true, reason: 'owner'};
  }

  // For public rooms, allow any authenticated user as a participant
  return {authorized: true, reason: 'participant'};
}
