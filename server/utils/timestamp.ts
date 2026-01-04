import {logger} from './logger.js';

/**
 * Safely converts a timestamp to an ISO string.
 * If the timestamp is invalid, falls back to the current time and logs a warning.
 */
export function timestampToISOString(timestamp: number | undefined | null): string {
  // Check if timestamp is a valid number
  if (timestamp == null || typeof timestamp !== 'number' || isNaN(timestamp)) {
    logger.warn(
      {timestamp, fallbackTo: Date.now()},
      'Invalid timestamp provided, using current time as fallback'
    );
    return new Date().toISOString();
  }

  // Create Date object and check if it's valid
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    logger.warn(
      {timestamp, fallbackTo: Date.now()},
      'Invalid Date created from timestamp, using current time as fallback'
    );
    return new Date().toISOString();
  }

  return date.toISOString();
}
