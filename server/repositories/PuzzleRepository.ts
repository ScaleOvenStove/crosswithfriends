/**
 * Puzzle Repository Implementation
 * Handles all database operations for puzzles
 *
 */

import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import type {Pool} from 'pg';
import * as uuid from 'uuid';

import {convertCluesToV2, convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {logger} from '../utils/logger.js';
import {extractNormalizedData} from '../utils/puzzleFormatUtils.js';
import {validatePuzzle} from '../validation/puzzleSchema.js';

import type {IPuzzleRepository} from './interfaces/IPuzzleRepository.js';

export class PuzzleRepository implements IPuzzleRepository {
  constructor(private readonly pool: Pool) {}

  async findById(pid: string): Promise<PuzzleJson> {
    const startTime = Date.now();
    // Query uses normalized columns where available, falls back to puzzle_data for grid/clues
    // The puzzle_data column contains solution, puzzle grid, and clues
    const {rows} = await this.pool.query(
      `
      SELECT
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_type,
        puzzle_data
      FROM puzzles
      WHERE pid = $1
    `,
      [pid]
    );
    const ms = Date.now() - startTime;
    logger.debug(`getPuzzle (${pid}) took ${ms}ms`);

    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error(`Puzzle ${pid} not found`);
    }

    // Reconstruct full PuzzleJson from normalized columns + puzzle_data
    // Start with puzzle_data and overlay normalized metadata
    const puzzleData = firstRow.puzzle_data || {};
    const puzzle: PuzzleJson = {
      ...convertOldFormatToIpuz(puzzleData),
      // Overlay normalized columns (these are authoritative after migration)
      title: firstRow.title || puzzleData.title || '',
      author: firstRow.author || puzzleData.author || '',
      copyright: firstRow.copyright || puzzleData.copyright || '',
      notes: firstRow.notes || puzzleData.notes || '',
      version: firstRow.version || puzzleData.version || 'http://ipuz.org/v1',
      kind: firstRow.kind || puzzleData.kind || ['http://ipuz.org/crossword#1'],
      dimensions: {
        width: firstRow.width || puzzleData.dimensions?.width || 0,
        height: firstRow.height || puzzleData.dimensions?.height || 0,
      },
    };

    // Debug: Log clues before conversion
    logger.debug(
      {
        pid,
        hasClues: !!puzzle.clues,
        cluesKeys: puzzle.clues ? Object.keys(puzzle.clues) : [],
        acrossCount:
          puzzle.clues && 'Across' in puzzle.clues && Array.isArray(puzzle.clues.Across)
            ? puzzle.clues.Across.length
            : 0,
        downCount:
          puzzle.clues && 'Down' in puzzle.clues && Array.isArray(puzzle.clues.Down)
            ? puzzle.clues.Down.length
            : 0,
      },
      'Puzzle clues before conversion'
    );

    // Convert any v1 array format clues to v2 object format
    if (puzzle.clues) {
      puzzle.clues = convertCluesToV2(puzzle.clues);

      // Debug: Log clues after conversion
      const convertedClues = puzzle.clues as {Across?: unknown[]; Down?: unknown[]};
      logger.debug(
        {
          pid,
          acrossCount: convertedClues.Across?.length || 0,
          downCount: convertedClues.Down?.length || 0,
        },
        'Puzzle clues after conversion'
      );

      // Remove any lowercase arrays (legacy format artifacts)
      // We only use capitalized Across/Down in ipuz v2 format
      if ('across' in puzzle.clues) {
        delete (puzzle.clues as {across?: unknown}).across;
      }
      if ('down' in puzzle.clues) {
        delete (puzzle.clues as {down?: unknown}).down;
      }
    } else {
      logger.warn({pid}, 'Puzzle has no clues object after convertOldFormatToIpuz');
    }

    return puzzle;
  }

  async findByIdOrNull(pid: string): Promise<PuzzleJson | null> {
    try {
      return await this.findById(pid);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async create(pid: string, puzzle: PuzzleJson, isPublic = false): Promise<string> {
    let puzzleId = pid;
    if (!puzzleId) {
      puzzleId = uuid.v4().substring(0, 8);
    }

    PuzzleRepository.validatePuzzle(puzzle);

    // Normalize clues to v2 format before saving
    // This ensures consistent storage format regardless of input format
    const normalizedPuzzle = {...puzzle};
    if (normalizedPuzzle.clues) {
      normalizedPuzzle.clues = convertCluesToV2(normalizedPuzzle.clues);
      // Remove any lowercase arrays (legacy format artifacts)
      // We only use capitalized Across/Down in ipuz v2 format
      if ('across' in normalizedPuzzle.clues) {
        delete (normalizedPuzzle.clues as {across?: unknown}).across;
      }
      if ('down' in normalizedPuzzle.clues) {
        delete (normalizedPuzzle.clues as {down?: unknown}).down;
      }
    }

    const uploaded_at = Date.now();

    // Only set pid_numeric if pid is numeric, otherwise NULL
    // Check if pid matches numeric pattern: digits optionally with decimal point
    const pidNumeric = /^([0-9]+[.]?[0-9]*|[.][0-9]+)$/.test(puzzleId) ? puzzleId : null;

    // Extract normalized data for dedicated columns
    const normalizedData = extractNormalizedData(normalizedPuzzle);

    // Insert with normalized columns + puzzle_data JSONB
    // Note: puzzle_type is a generated column computed from height, so it's not in the INSERT
    await this.pool.query(
      `
      INSERT INTO puzzles (
        pid,
        pid_numeric,
        uid,
        is_public,
        uploaded_at,
        updated_at,
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_data
      )
      VALUES ($1, $2, $3, $4, to_timestamp($5), to_timestamp($5), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        puzzleId,
        pidNumeric,
        null, // uid - can be passed in later if needed
        isPublic,
        uploaded_at / 1000,
        normalizedData.title,
        normalizedData.author,
        normalizedData.copyright,
        normalizedData.notes,
        normalizedData.version,
        normalizedData.kind,
        normalizedData.width,
        normalizedData.height,
        normalizedPuzzle,
      ]
    );

    return puzzleId;
  }

  async list(
    filters?: ListPuzzleRequestFilters,
    limit = 50,
    offset = 0
  ): Promise<{
    puzzles: Array<{pid: string; puzzle: PuzzleJson}>;
    total: number;
  }> {
    const startTime = Date.now();

    const defaultFilters: ListPuzzleRequestFilters = {
      nameOrTitleFilter: '',
      sizeFilter: {Mini: true, Standard: true},
    };

    const filter = filters || defaultFilters;

    // Filter out empty strings from search terms
    const parametersForTitleAuthorFilter = filter.nameOrTitleFilter
      .split(/\s/)
      .filter((s) => s.length > 0)
      .map((s) => `%${s}%`);

    const sizeFilterArray = PuzzleRepository.mapSizeFilterForDB(filter.sizeFilter);

    // Parameter offset depends on whether size filter is present
    const parameterOffset = sizeFilterArray.length > 0 ? 4 : 3;

    // Use normalized columns for filtering (much faster than JSONB extraction)
    const parameterizedTileAuthorFilter = parametersForTitleAuthorFilter
      .map((_s, idx) => `AND (title || ' ' || author) ILIKE $${idx + parameterOffset}`)
      .join('\n');

    // Build count-specific title/author filter with correct parameter indices
    const countParamOffset = sizeFilterArray.length > 0 ? 2 : 1;
    const countTitleAuthorFilter = parametersForTitleAuthorFilter
      .map((_s, idx) => `AND (title || ' ' || author) ILIKE $${idx + countParamOffset}`)
      .join('\n');

    // Use normalized puzzle_type column for size filtering (much faster)
    const sizeFilterCondition = sizeFilterArray.length > 0 ? `AND puzzle_type = ANY($1)` : '';

    const queryParams =
      sizeFilterArray.length > 0
        ? [sizeFilterArray, limit, offset, ...parametersForTitleAuthorFilter]
        : [limit, offset, ...parametersForTitleAuthorFilter];

    // Execute count query with same filters to get total
    const countQueryParams =
      sizeFilterArray.length > 0
        ? [sizeFilterArray, ...parametersForTitleAuthorFilter]
        : [...parametersForTitleAuthorFilter];

    const countResult = await this.pool.query(
      `
      SELECT COUNT(*) as total
      FROM puzzles
      WHERE is_public = true
      ${sizeFilterCondition}
      ${countTitleAuthorFilter}
    `,
      countQueryParams
    );

    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Execute paginated query using normalized columns
    const result = await this.pool.query(
      `
      SELECT 
        pid,
        uploaded_at,
        title,
        author,
        copyright,
        notes,
        version,
        kind,
        width,
        height,
        puzzle_type,
        puzzle_data,
        times_solved
      FROM puzzles
      WHERE is_public = true
      ${sizeFilterCondition}
      ${parameterizedTileAuthorFilter}
      ORDER BY pid_numeric DESC
      LIMIT $${sizeFilterArray.length > 0 ? '2' : '1'}
      OFFSET $${sizeFilterArray.length > 0 ? '3' : '2'}
    `,
      queryParams
    );
    const rows = result.rows;

    // Reconstruct PuzzleJson from normalized columns + puzzle_data
    const puzzles = rows.map(
      (row: {
        pid: string;
        title: string;
        author: string;
        copyright: string;
        notes: string;
        version: string;
        kind: string[];
        width: number;
        height: number;
        puzzle_type: string;
        puzzle_data: PuzzleJson;
        times_solved: string;
      }) => ({
        pid: row.pid,
        puzzle: {
          ...row.puzzle_data,
          title: row.title,
          author: row.author,
          copyright: row.copyright,
          notes: row.notes,
          version: row.version,
          kind: row.kind,
          dimensions: {width: row.width, height: row.height},
        } as PuzzleJson,
      })
    );

    const ms = Date.now() - startTime;
    logger.debug(`listPuzzles (${JSON.stringify(filter)}, ${limit}, ${offset}) took ${ms}ms`);

    return {
      puzzles,
      total,
    };
  }

  async delete(pid: string): Promise<void> {
    await this.pool.query('DELETE FROM puzzles WHERE pid = $1', [pid]);
  }

  async recordSolve(pid: string, gid: string, solveTimeMs: number): Promise<void> {
    const solved_time = Date.now();

    // Clients may log a solve multiple times; skip logging after the first one goes through
    if (await this.isGidAlreadySolved(gid)) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve)
        VALUES ($1, $2, to_timestamp($3), $4)
      `,
        [pid, gid, solved_time / 1000.0, solveTimeMs]
      );
      await client.query(
        `
        UPDATE puzzles SET times_solved = times_solved + 1, updated_at = NOW()
        WHERE pid = $1
      `,
        [pid]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(
        {err: error, pid, gid, solved_time, timeToSolve: solveTimeMs},
        'Failed to record puzzle solve'
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async getSolveStats(pid: string): Promise<{
    averageSolveTime: number;
    totalSolves: number;
    fastestSolveTime: number;
  } | null> {
    const {rows} = await this.pool.query(
      `
      SELECT
        AVG(time_taken_to_solve) as average_solve_time,
        COUNT(*) as total_solves,
        MIN(time_taken_to_solve) as fastest_solve_time
      FROM puzzle_solves
      WHERE pid = $1
    `,
      [pid]
    );

    const firstRow = rows[0];
    if (!firstRow || firstRow.total_solves === '0') {
      return null;
    }

    return {
      averageSolveTime: parseFloat(firstRow.average_solve_time),
      totalSolves: parseInt(firstRow.total_solves, 10),
      fastestSolveTime: parseFloat(firstRow.fastest_solve_time),
    };
  }

  // Private helper methods

  private async isGidAlreadySolved(gid: string): Promise<boolean> {
    const {rows} = await this.pool.query(
      `
      SELECT COUNT(*)
      FROM puzzle_solves
      WHERE gid=$1
    `,
      [gid]
    );
    const firstRow = rows[0];
    if (!firstRow) {
      return false;
    }
    return firstRow.count > 0;
  }

  private static mapSizeFilterForDB(sizeFilter: ListPuzzleRequestFilters['sizeFilter']): string[] {
    const ret = [];
    if (sizeFilter.Mini) {
      ret.push('Mini Puzzle');
    }
    if (sizeFilter.Standard) {
      ret.push('Daily Puzzle');
    }
    return ret;
  }

  private static validatePuzzle(puzzle: unknown): void {
    logger.debug({keys: puzzle && typeof puzzle === 'object' ? Object.keys(puzzle) : []}, 'Puzzle keys');
    // Use centralized Zod validation
    validatePuzzle(puzzle);

    // Additional validation: Ensure solution array is not empty
    if (puzzle && typeof puzzle === 'object' && 'solution' in puzzle) {
      const solution = (puzzle as {solution?: unknown}).solution;
      if (!Array.isArray(solution) || solution.length === 0) {
        throw new Error('Puzzle solution array must not be empty');
      }
      if (!Array.isArray(solution[0]) || solution[0].length === 0) {
        throw new Error('Puzzle solution must have at least one non-empty row');
      }
    }
  }
}
