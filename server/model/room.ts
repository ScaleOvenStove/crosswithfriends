import type {RoomEvent} from '@crosswithfriends/shared/roomEvents';

import {logger} from '../utils/logger.js';
import {timestampToISOString} from '../utils/timestamp.js';

import {pool} from './pool.js';

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
