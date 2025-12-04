/**
 * Counters Repository Interface
 * Defines the contract for ID generation operations
 */

export interface ICountersRepository {
  /**
   * Get next game ID
   */
  getNextGameId(): Promise<string>;

  /**
   * Get next puzzle ID
   */
  getNextPuzzleId(): Promise<string>;
}
