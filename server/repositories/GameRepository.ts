/**
 * Game Repository Implementation
 * Handles all database operations for game events
 */

import type {CellIndex, GameJson} from '@crosswithfriends/shared/types';
import type {Pool, PoolClient} from 'pg';

import type {GameEvent, InitialGameEvent} from '../model/game.js';
import {convertPuzzleToGameFormat} from '../services/PuzzleFormatConverter.js';
import {logger} from '../utils/logger.js';
import {timestampToISOString} from '../utils/timestamp.js';

import type {IGameRepository} from './interfaces/IGameRepository.js';
import type {IPuzzleRepository} from './interfaces/IPuzzleRepository.js';

export class GameRepository implements IGameRepository {
  constructor(
    private readonly pool: Pool,
    private readonly puzzleRepository: IPuzzleRepository
  ) {}

  async getEvents(
    gid: string,
    options?: {limit?: number; offset?: number}
  ): Promise<{events: GameEvent[]; total: number}> {
    const startTime = Date.now();

    // Use COUNT(*) OVER() window function to get total in a single query
    let query = `
      SELECT 
        event_payload,
        COUNT(*) OVER() as total
      FROM game_events 
      WHERE gid=$1 
      ORDER BY ts ASC
    `;
    const params: unknown[] = [gid];

    if (options?.limit) {
      query += ' LIMIT $2';
      params.push(options.limit);

      if (options?.offset) {
        query += ' OFFSET $3';
        params.push(options.offset);
      }
    }

    const res = await this.pool.query(query, params);
    const events = res.rows.map((row) => row.event_payload).filter((payload) => payload !== undefined);
    const total =
      res.rows.length > 0 && res.rows[0].total !== undefined ? parseInt(String(res.rows[0].total), 10) : 0;

    const ms = Date.now() - startTime;
    logger.debug(`getGameEvents(${gid}) took ${ms}ms`);

    return {events, total};
  }

  async getInfo(gid: string): Promise<GameJson['info']> {
    const res = await this.pool.query(
      "SELECT event_payload FROM game_events WHERE gid=$1 AND event_type='create'",
      [gid]
    );

    if (res.rowCount != 1 || !res.rows[0]?.event_payload) {
      logger.warn(`Could not find info for game ${gid}`);
      return {
        title: '',
        author: '',
        copyright: '',
        description: '',
      };
    }

    const eventPayload = res.rows[0].event_payload;
    const info = eventPayload?.params?.game?.info;
    if (!info) {
      logger.warn(`Game ${gid} has no info in create event`);
      return {
        title: '',
        author: '',
        copyright: '',
        description: '',
      };
    }

    logger.debug(`${gid} game info: ${JSON.stringify(info)}`);
    return info;
  }

  async addEvent(gid: string, event: GameEvent): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
      VALUES ($1, $2, $3, $4, $5)`,
      [gid, event.user, timestampToISOString(event.timestamp), event.type, event]
    );
  }

  /**
   * Execute multiple operations within a transaction
   * @param operations - Array of async functions that take a client and return a promise
   */
  async withTransaction<T>(operations: Array<(client: PoolClient) => Promise<T>>): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results: T[] = [];
      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({err: error}, 'Transaction failed, rolling back');
      throw error;
    } finally {
      client.release();
    }
  }

  async createInitialEvent(gid: string, pid: string, userId?: string | null): Promise<string> {
    // Fetch puzzle (read operation, doesn't need transaction)
    const puzzle = await this.puzzleRepository.findById(pid);
    logger.debug({pid}, 'got puzzle');

    // Use centralized format converter
    const converted = convertPuzzleToGameFormat(puzzle, pid);

    const initialEvent: InitialGameEvent = {
      user: userId || null,
      timestamp: Date.now(),
      type: 'create',
      params: {
        pid,
        version: 1.0,
        game: {
          info: {
            title: converted.title,
            author: converted.author,
            copyright: converted.copyright,
            description: converted.description,
            type: converted.type,
          },
          grid: converted.grid,
          solution: converted.solution,
          clues: converted.clues,
          circles: converted.circles.length > 0 ? (converted.circles as CellIndex[]) : undefined,
          shades: converted.shades.length > 0 ? (converted.shades as CellIndex[]) : undefined,
        },
      },
    };

    // Use transaction for event creation (allows for future expansion with multiple operations)
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          gid,
          initialEvent.user,
          timestampToISOString(initialEvent.timestamp),
          initialEvent.type,
          initialEvent,
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({err: error, gid, pid}, 'Failed to create initial game event');
      throw error;
    } finally {
      client.release();
    }

    return gid;
  }
}
