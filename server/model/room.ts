import type {RoomEvent} from '@shared/roomEvents';

import {logger} from '../utils/logger.js';

import {pool} from './pool.js';

/**
 * Safely converts a timestamp to an ISO string.
 * If the timestamp is invalid, falls back to the current time and logs a warning.
 */
function timestampToISOString(timestamp: number | undefined | null): string {
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

export async function getRoomEvents(rid: string): Promise<RoomEvent[]> {
  const startTime = Date.now();
  const res = await pool.query('SELECT event_payload FROM room_events WHERE rid=$1 ORDER BY ts ASC', [rid]);
  const events = res.rows.map((row) => row.event_payload);
  const ms = Date.now() - startTime;
  logger.debug(`getRoomEvents(${rid}) took ${ms}ms`);
  return events;
}

export async function addRoomEvent(rid: string, event: RoomEvent): Promise<void> {
  const startTime = Date.now();
  await pool.query(
    `
      INSERT INTO room_events (rid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
    [rid, event.uid, timestampToISOString(event.timestamp), event.type, event]
  );
  const ms = Date.now() - startTime;
  logger.debug(`addRoomEvent(${rid}, ${event.type}) took ${ms}ms`);
}
