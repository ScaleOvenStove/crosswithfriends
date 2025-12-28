/**
 * Counters Repository Implementation
 * Handles ID generation for games and puzzles
 */

import type {Pool} from 'pg';

import type {ICountersRepository} from './interfaces/ICountersRepository.js';

export class CountersRepository implements ICountersRepository {
  constructor(private readonly pool: Pool) {}

  async getNextGameId(): Promise<string> {
    const res = await this.pool.query("SELECT nextval('gid_counter') as nextval");
    const firstRow = res.rows[0];
    if (!firstRow) {
      throw new Error('Failed to get next game ID');
    }
    return firstRow.nextval as string;
  }

  async getNextPuzzleId(): Promise<string> {
    const res = await this.pool.query("SELECT nextval('pid_counter') as nextval");
    const firstRow = res.rows[0];
    if (!firstRow) {
      throw new Error('Failed to get next puzzle ID');
    }
    return firstRow.nextval as string;
  }
}
