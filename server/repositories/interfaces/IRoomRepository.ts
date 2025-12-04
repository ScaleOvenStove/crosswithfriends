/**
 * Room Repository Interface
 * Defines the contract for room event data access operations
 */

import type {RoomEvent} from '@crosswithfriends/shared/roomEvents';

export interface IRoomRepository {
  /**
   * Get all events for a room
   */
  getEvents(rid: string): Promise<RoomEvent[]>;

  /**
   * Add a room event
   */
  addEvent(rid: string, event: RoomEvent): Promise<void>;
}
