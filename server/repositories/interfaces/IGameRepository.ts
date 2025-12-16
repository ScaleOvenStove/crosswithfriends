/**
 * Game Repository Interface
 * Defines the contract for game event data access operations
 */

import type {GameJson} from '@crosswithfriends/shared/types';

import type {GameEvent} from '../../model/game.js';

export interface IGameRepository {
  /**
   * Get all events for a game
   */
  getEvents(
    gid: string,
    options?: {limit?: number; offset?: number}
  ): Promise<{
    events: GameEvent[];
    total: number;
  }>;

  /**
   * Get game info (puzzle metadata)
   * @returns Game info or default empty object if not found
   */
  getInfo(gid: string): Promise<GameJson['info']>;

  /**
   * Add a game event
   */
  addEvent(gid: string, event: GameEvent): Promise<void>;

  /**
   * Create initial game event from a puzzle
   */
  createInitialEvent(gid: string, pid: string, userId?: string | null): Promise<string>;
}
