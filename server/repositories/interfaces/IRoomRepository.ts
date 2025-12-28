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

  /**
   * Get the creator (first user) of a room
   * @returns User ID of the room creator, or null if not found
   */
  getCreator(rid: string): Promise<string | null>;

  /**
   * Check if a room exists
   */
  exists(rid: string): Promise<boolean>;
}
