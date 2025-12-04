/**
 * Puzzle Repository Implementation
 * Handles all database operations for puzzles
 */

import type {ListPuzzleRequestFilters, PuzzleJson} from '@crosswithfriends/shared/types';
import Joi from 'joi';
import type {Pool} from 'pg';
import * as uuid from 'uuid';

import {convertCluesToV2, convertOldFormatToIpuz} from '../adapters/puzzleFormatAdapter.js';
import {logger} from '../utils/logger.js';

import type {IPuzzleRepository} from './interfaces/IPuzzleRepository.js';

export class PuzzleRepository implements IPuzzleRepository {
  constructor(private readonly pool: Pool) {}

  async findById(pid: string): Promise<PuzzleJson> {
    const startTime = Date.now();
    const {rows} = await this.pool.query(
      `
      SELECT content
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

    // Always return ipuz format to clients
    const puzzle = convertOldFormatToIpuz(firstRow.content);

    // Convert any v1 array format clues to v2 object format
    if (puzzle.clues) {
      puzzle.clues = convertCluesToV2(puzzle.clues);
      // Remove any lowercase arrays (legacy format artifacts)
      // We only use capitalized Across/Down in ipuz v2 format
      if ('across' in puzzle.clues) {
        delete (puzzle.clues as {across?: unknown}).across;
      }
      if ('down' in puzzle.clues) {
        delete (puzzle.clues as {down?: unknown}).down;
      }
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

    await this.pool.query(
      `
      INSERT INTO puzzles (pid, uploaded_at, is_public, content, pid_numeric)
      VALUES ($1, to_timestamp($2), $3, $4, $5)`,
      [puzzleId, uploaded_at / 1000, isPublic, normalizedPuzzle, pidNumeric]
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

    const parameterizedTileAuthorFilter = parametersForTitleAuthorFilter
      .map(
        (_s, idx) =>
          `AND (
          (COALESCE(content ->> 'title', content -> 'info' ->> 'title', '') || ' ' ||
           COALESCE(content ->> 'author', content -> 'info' ->> 'author', '')) ILIKE $${idx + parameterOffset}
        )`
      )
      .join('\n');

    const sizeFilterCondition =
      sizeFilterArray.length > 0
        ? `AND (
      CASE
        WHEN content->'info'->>'type' IS NOT NULL THEN
          (content->'info'->>'type')
        WHEN jsonb_array_length(content->'solution') <= 10 THEN 'Mini Puzzle'
        ELSE 'Daily Puzzle'
      END = ANY($1)
    )`
        : '';

    const queryParams =
      sizeFilterArray.length > 0
        ? [sizeFilterArray, limit, offset, ...parametersForTitleAuthorFilter]
        : [limit, offset, ...parametersForTitleAuthorFilter];

    // Execute count query with same filters to get total
    const countQueryParams = sizeFilterArray.length > 0
      ? [sizeFilterArray, ...parametersForTitleAuthorFilter]
      : [...parametersForTitleAuthorFilter];
    
    const countResult = await this.pool.query(
      `
      SELECT COUNT(*) as total
      FROM puzzles
      WHERE is_public = true
      ${sizeFilterCondition}
      ${parameterizedTileAuthorFilter}
    `,
      countQueryParams
    );

    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Execute paginated query
    const {rows} = await this.pool.query(
      `
      SELECT pid, uploaded_at, content, times_solved
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

    const puzzles = rows.map((row: {pid: string; content: PuzzleJson; times_solved: string}) => ({
      pid: row.pid,
      puzzle: row.content,
    }));

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
        UPDATE puzzles SET times_solved = times_solved + 1
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
    const string = (): Joi.StringSchema => Joi.string().allow('');

    const puzzleValidator = Joi.object({
      version: string().required(),
      kind: Joi.array().items(string()).required(),
      dimensions: Joi.object({
        width: Joi.number().integer().required(),
        height: Joi.number().integer().required(),
      }).required(),
      title: string().required(),
      author: string().required(),
      copyright: string().optional(),
      notes: string().optional(),
      solution: Joi.array()
        .items(
          Joi.array()
            .items(Joi.alternatives().try(string(), Joi.valid(null, '#')))
            .min(1)
        )
        .min(1)
        .required(),
      puzzle: Joi.array()
        .items(
          Joi.array().items(
            Joi.alternatives().try(
              Joi.number(),
              Joi.string(),
              Joi.object({
                cell: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
                style: Joi.object({
                  shapebg: string().optional(),
                  fillbg: string().optional(),
                }).optional(),
              }),
              Joi.valid(null)
            )
          )
        )
        .required(),
      clues: Joi.object({
        Across: Joi.array()
          .items(
            Joi.alternatives().try(
              Joi.array().items(string()),
              Joi.object({
                number: string(),
                clue: string(),
                cells: Joi.array().optional(),
              })
            )
          )
          .required(),
        Down: Joi.array()
          .items(
            Joi.alternatives().try(
              Joi.array().items(string()),
              Joi.object({
                number: string(),
                clue: string(),
                cells: Joi.array().optional(),
              })
            )
          )
          .required(),
      }).required(),
    });

    logger.debug({keys: puzzle && typeof puzzle === 'object' ? Object.keys(puzzle) : []}, 'Puzzle keys');
    const {error} = puzzleValidator.validate(puzzle);
    if (error) {
      throw new Error(error.message);
    }

    // Ensure solution array is not empty
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
