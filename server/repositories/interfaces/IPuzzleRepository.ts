/**
 * Puzzle Repository Interface
 * Defines the contract for puzzle data access operations
 */

import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';

export interface IPuzzleRepository {
  /**
   * Find a puzzle by ID
   * @throws Error if puzzle not found
   */
  findById(pid: string): Promise<PuzzleJson>;

  /**
   * Find a puzzle by ID, returning null if not found
   */
  findByIdOrNull(pid: string): Promise<PuzzleJson | null>;

  /**
   * Create a new puzzle
   * @returns The puzzle ID
   */
  create(pid: string, puzzle: PuzzleJson, isPublic?: boolean): Promise<string>;

  /**
   * List puzzles with optional filters and pagination
   */
  list(
    filters?: ListPuzzleRequestFilters,
    limit?: number,
    offset?: number
  ): Promise<{
    puzzles: Array<{pid: string; puzzle: PuzzleJson}>;
    total: number;
  }>;

  /**
   * Delete a puzzle by ID
   */
  delete(pid: string): Promise<void>;

  /**
   * Record a puzzle solve
   */
  recordSolve(pid: string, gid: string, solveTimeMs: number): Promise<void>;

  /**
   * Get puzzle solve statistics
   */
  getSolveStats(pid: string): Promise<{
    averageSolveTime: number;
    totalSolves: number;
    fastestSolveTime: number;
  } | null>;
}
