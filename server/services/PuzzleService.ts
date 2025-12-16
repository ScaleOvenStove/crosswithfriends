/**
 * Puzzle Service
 * Handles business logic for puzzle operations
 */

import type {IPuzzleRepository} from '../repositories/interfaces/IPuzzleRepository.js';

export class PuzzleService {
  constructor(private readonly puzzleRepository: IPuzzleRepository) {}

  /**
   * Helper to determine puzzle type from ipuz solution array length
   */
  private static getPuzzleTypeFromIpuz(ipuz: {solution?: unknown}): string {
    const solution = Array.isArray(ipuz.solution) ? ipuz.solution : [];
    return solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';
  }

  /**
   * Extracts puzzle information (title, author, etc.) from a puzzle
   * Supports both old format (with info object) and ipuz format
   */
  async getPuzzleInfo(
    pid: string
  ): Promise<{title: string; author: string; copyright: string; description: string; type?: string}> {
    const puzzle = await this.puzzleRepository.findById(pid);

    // IMPORTANT: Production and staging share the same database, so we must support both formats
    // Handle old format (with info object) and ipuz format (title/author at root)
    if ('info' in puzzle && puzzle.info && typeof puzzle.info === 'object') {
      // Old format: extract from info object
      const info = puzzle.info as {
        title?: string;
        author?: string;
        copyright?: string;
        description?: string;
        type?: string;
      };
      return {
        title: info.title || '',
        author: info.author || '',
        copyright: info.copyright || '',
        description: info.description || '',
        type: info.type,
      };
    }

    // New format (ipuz): extract from root level
    return {
      title: puzzle.title || '',
      author: puzzle.author || '',
      copyright: puzzle.copyright || '',
      description: puzzle.notes || '',
      type: PuzzleService.getPuzzleTypeFromIpuz(puzzle),
    };
  }
}
