/**
 * WebSocket Rate Limiting Utility
 * Prevents DoS attacks by limiting event frequency per socket
 *
 * Features:
 * - Per-socket rate limiting with configurable limits
 * - Automatic TTL-based cleanup to prevent memory leaks
 * - Size limits with LRU eviction for protection against resource exhaustion
 */

import type {Socket} from 'socket.io';

import {logger} from './logger.js';

interface RateLimitConfig {
  maxEvents: number; // Maximum events allowed
  timeWindowMs: number; // Time window in milliseconds
}

interface SocketRateLimitState {
  eventCount: number;
  windowStart: number;
  lastActivity: number; // Track last activity for TTL cleanup
  userId?: string; // Optional user ID for user-based rate limiting
}

// Configuration
const defaultConfig: RateLimitConfig = {
  maxEvents: 100, // Allow 100 events
  timeWindowMs: 60000, // Per 60 seconds (1 minute)
};

// Memory management settings
const MAX_MAP_SIZE = 10000; // Maximum entries in the map
const CLEANUP_INTERVAL_MS = 60000; // Run cleanup every 60 seconds
const ENTRY_TTL_MS = 300000; // Remove entries older than 5 minutes of inactivity

// Map of socket ID to rate limit state
const rateLimitState = new Map<string, SocketRateLimitState>();

// Map of user ID to aggregate rate limit across all their sockets
// This prevents users from bypassing rate limits by opening multiple connections
const userRateLimitState = new Map<string, {eventCount: number; windowStart: number; lastActivity: number}>();

// User-level rate limit (stricter than per-socket)
const USER_RATE_LIMIT = {
  maxEvents: 200, // Allow 200 events per minute across all connections
  timeWindowMs: 60000,
};

// Track cleanup interval
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Initializes the rate limiter with automatic cleanup
 * Should be called once on server start
 */
export function initRateLimiter(): void {
  if (cleanupIntervalId !== null) {
    return; // Already initialized
  }

  cleanupIntervalId = setInterval(() => {
    cleanupStaleEntries();
  }, CLEANUP_INTERVAL_MS);

  // Ensure the interval doesn't prevent Node from exiting
  if (cleanupIntervalId.unref) {
    cleanupIntervalId.unref();
  }

  logger.debug('Rate limiter initialized with automatic cleanup');
}

/**
 * Stops the rate limiter cleanup interval
 * Should be called on server shutdown
 */
export function stopRateLimiter(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  rateLimitState.clear();
  userRateLimitState.clear();
  logger.debug('Rate limiter stopped');
}

/**
 * Removes stale entries that have exceeded TTL
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  const staleThreshold = now - ENTRY_TTL_MS;
  let removedSocketCount = 0;
  let removedUserCount = 0;

  // Clean up socket-level entries
  for (const [socketId, state] of rateLimitState) {
    if (state.lastActivity < staleThreshold) {
      rateLimitState.delete(socketId);
      removedSocketCount++;
    }
  }

  // Clean up user-level entries
  for (const [userId, state] of userRateLimitState) {
    if (state.lastActivity < staleThreshold) {
      userRateLimitState.delete(userId);
      removedUserCount++;
    }
  }

  if (removedSocketCount > 0 || removedUserCount > 0) {
    logger.debug(
      {
        removedSocketCount,
        removedUserCount,
        remainingSocketSize: rateLimitState.size,
        remainingUserSize: userRateLimitState.size,
      },
      'Cleaned up stale rate limit entries'
    );
  }
}

/**
 * Evicts oldest entries when map exceeds size limit (LRU-style eviction)
 */
function evictOldestEntries(): void {
  if (rateLimitState.size <= MAX_MAP_SIZE) {
    return;
  }

  // Convert to array and sort by lastActivity (oldest first)
  const entries = Array.from(rateLimitState.entries()).sort((a, b) => a[1].lastActivity - b[1].lastActivity);

  // Remove oldest 10% of entries
  const removeCount = Math.max(1, Math.floor(MAX_MAP_SIZE * 0.1));
  for (let i = 0; i < removeCount && i < entries.length; i++) {
    const entry = entries[i];
    if (entry) {
      rateLimitState.delete(entry[0]);
    }
  }

  logger.warn(
    {removedCount: removeCount, newSize: rateLimitState.size},
    'Rate limit map size exceeded, evicted oldest entries'
  );
}

/**
 * Cleans up rate limit state for disconnected sockets
 */
export function cleanupRateLimitState(socketId: string): void {
  rateLimitState.delete(socketId);
}

/**
 * Checks user-level rate limit (across all their sockets)
 * @param userId - User ID
 * @returns true if within limits, false if exceeded
 */
function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  let state = userRateLimitState.get(userId);

  if (!state) {
    // First event for this user
    userRateLimitState.set(userId, {
      eventCount: 1,
      windowStart: now,
      lastActivity: now,
    });
    return true;
  }

  // Update last activity
  state.lastActivity = now;

  // Check if we're in a new time window
  if (now - state.windowStart >= USER_RATE_LIMIT.timeWindowMs) {
    // Reset the window
    state.eventCount = 1;
    state.windowStart = now;
    return true;
  }

  // Increment event count
  state.eventCount += 1;

  // Check if limit exceeded
  if (state.eventCount > USER_RATE_LIMIT.maxEvents) {
    logger.warn(
      {
        userId,
        eventCount: state.eventCount,
        maxEvents: USER_RATE_LIMIT.maxEvents,
        timeWindowMs: USER_RATE_LIMIT.timeWindowMs,
      },
      '[socket] User-level rate limit exceeded'
    );
    return false;
  }

  return true;
}

/**
 * Checks if a socket has exceeded rate limits
 * Applies both socket-level and user-level rate limiting for authenticated sockets
 * @param socket - Socket.IO socket instance
 * @param config - Rate limit configuration
 * @returns true if within limits, false if exceeded
 */
export function checkRateLimit(socket: Socket, config: RateLimitConfig = defaultConfig): boolean {
  const socketId = socket.id;
  const now = Date.now();

  // Get user ID from socket if available (set during connection)
  const userId = (socket as Socket & {userId?: string | null}).userId;

  // Check user-level rate limit first (if authenticated)
  if (userId && !checkUserRateLimit(userId)) {
    return false;
  }

  const state = rateLimitState.get(socketId);

  if (!state) {
    // Check map size before adding new entry
    if (rateLimitState.size >= MAX_MAP_SIZE) {
      evictOldestEntries();
    }

    // First event for this socket, initialize state
    rateLimitState.set(socketId, {
      eventCount: 1,
      windowStart: now,
      lastActivity: now,
      userId: userId || undefined,
    });
    return true;
  }

  // Update last activity and user ID (in case it changed)
  state.lastActivity = now;
  if (userId) {
    state.userId = userId;
  }

  // Check if we're in a new time window
  if (now - state.windowStart >= config.timeWindowMs) {
    // Reset the window
    state.eventCount = 1;
    state.windowStart = now;
    return true;
  }

  // Increment event count
  state.eventCount += 1;

  // Check if limit exceeded
  if (state.eventCount > config.maxEvents) {
    logger.warn(
      {
        socketId,
        userId: userId || 'anonymous',
        eventCount: state.eventCount,
        maxEvents: config.maxEvents,
        timeWindowMs: config.timeWindowMs,
      },
      '[socket] Rate limit exceeded for socket'
    );
    return false;
  }

  return true;
}

/**
 * Gets the current size of the rate limit map (for monitoring)
 */
export function getRateLimitMapSize(): number {
  return rateLimitState.size;
}

/**
 * Creates a rate limiting middleware for Socket.IO event handlers
 * @param _config - Rate limit configuration (currently unused, kept for API consistency)
 * @returns Middleware function
 */
export function createRateLimitMiddleware(_config: RateLimitConfig = defaultConfig) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    // Check map size before adding new entry
    if (rateLimitState.size >= MAX_MAP_SIZE) {
      evictOldestEntries();
    }

    // Initialize rate limit state on connection
    rateLimitState.set(socket.id, {
      eventCount: 0,
      windowStart: Date.now(),
      lastActivity: Date.now(),
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      cleanupRateLimitState(socket.id);
    });

    next();
  };
}

/**
 * Wraps a Socket.IO event handler with rate limiting
 * @param handler - Original event handler
 * @param config - Rate limit configuration
 * @returns Wrapped handler with rate limiting
 */
export function withRateLimit<T extends unknown[]>(
  handler: (socket: Socket, ...args: T) => void | Promise<void>,
  config: RateLimitConfig = defaultConfig
): (socket: Socket, ...args: T) => void | Promise<void> {
  return (socket: Socket, ...args: T): void | Promise<void> => {
    if (!checkRateLimit(socket, config)) {
      socket.emit('error', {message: 'Rate limit exceeded. Please slow down.'});
      socket.disconnect(true);
      return;
    }

    return handler(socket, ...args);
  };
}
