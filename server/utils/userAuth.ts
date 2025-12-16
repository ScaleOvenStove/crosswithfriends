/**
 * Minimal Authentication Utilities
 * Provides basic user ID extraction and validation
 */

import type {Socket} from 'socket.io';

/**
 * Extracts user ID from Socket.IO handshake
 * Supports extraction from:
 * - Query parameter: ?userId=xxx
 * - Auth token (if provided in future)
 * @param socket - Socket.IO socket instance
 * @returns User ID string or null if not provided
 */
export function extractUserIdFromSocket(socket: Socket): string | null {
  // Check if handshake exists
  if (!socket.handshake) {
    return null;
  }

  // Try query parameter first (most common for minimal auth)
  // Check if query exists and has userId
  if (socket.handshake.query) {
    const userId = socket.handshake.query.userId;
    if (typeof userId === 'string' && userId.trim()) {
      return userId.trim();
    }
  }

  // Try auth object if provided
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
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  // Basic validation: non-empty, reasonable length
  const trimmed = userId.trim();
  return trimmed.length > 0 && trimmed.length <= 200;
}

/**
 * Extracts user ID from Fastify request
 * Supports extraction from:
 * - Query parameter: ?userId=xxx
 * - Header: X-User-Id
 * - Body (for POST requests)
 * @param request - Fastify request object
 * @returns User ID string or null if not provided
 */
export function extractUserIdFromRequest(request: {
  query?: {userId?: string};
  headers?: {[key: string]: string | string[] | undefined};
  body?: {userId?: string};
}): string | null {
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
  if (request.body && typeof request.body === 'object' && 'userId' in request.body) {
    const userId = (request.body as {userId?: unknown}).userId;
    if (typeof userId === 'string') {
      const trimmed = userId.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
}

/**
 * Checks if a user is authorized to perform an action on a game
 * For minimal auth, we allow:
 * - Users who created the game (check first event)
 * - Any user for now (can be restricted later)
 * @param userId - User ID to check
 * @param gid - Game ID
 * @param getGameCreator - Function to get the game creator's user ID
 * @returns true if authorized, false otherwise
 */
export function isUserAuthorizedForGame(
  userId: string,
  _gid: string,
  _getGameCreator: (gid: string) => Promise<string | null>
): boolean {
  // For minimal auth, allow all authenticated users
  // This can be restricted later to only game creators or participants
  if (!isValidUserId(userId)) {
    return false;
  }

  // Optional: Check if user created the game
  // For now, we'll allow all authenticated users
  // Uncomment below to restrict to game creator only:
  // const creatorId = await getGameCreator(gid);
  // return creatorId === userId;

  return true;
}
