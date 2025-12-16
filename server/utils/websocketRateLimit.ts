/**
 * WebSocket Rate Limiting Utility
 * Prevents DoS attacks by limiting event frequency per socket
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
}

const defaultConfig: RateLimitConfig = {
  maxEvents: 100, // Allow 100 events
  timeWindowMs: 60000, // Per 60 seconds (1 minute)
};

// Map of socket ID to rate limit state
const rateLimitState = new Map<string, SocketRateLimitState>();

/**
 * Cleans up rate limit state for disconnected sockets
 */
export function cleanupRateLimitState(socketId: string): void {
  rateLimitState.delete(socketId);
}

/**
 * Checks if a socket has exceeded rate limits
 * @param socket - Socket.IO socket instance
 * @param config - Rate limit configuration
 * @returns true if within limits, false if exceeded
 */
export function checkRateLimit(socket: Socket, config: RateLimitConfig = defaultConfig): boolean {
  const socketId = socket.id;
  const now = Date.now();
  const state = rateLimitState.get(socketId);

  if (!state) {
    // First event for this socket, initialize state
    rateLimitState.set(socketId, {
      eventCount: 1,
      windowStart: now,
    });
    return true;
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
 * Creates a rate limiting middleware for Socket.IO event handlers
 * @param _config - Rate limit configuration (currently unused, kept for API consistency)
 * @returns Middleware function
 */
export function createRateLimitMiddleware(_config: RateLimitConfig = defaultConfig) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    // Initialize rate limit state on connection
    rateLimitState.set(socket.id, {
      eventCount: 0,
      windowStart: Date.now(),
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
