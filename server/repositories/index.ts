/**
 * Repository Factory and Registry
 * Central place to create and access all repositories
 */

import type {Pool} from 'pg';

import {CountersRepository} from './CountersRepository.js';
import {GameRepository} from './GameRepository.js';
import type {ICountersRepository} from './interfaces/ICountersRepository.js';
import type {IGameRepository} from './interfaces/IGameRepository.js';
import type {IPuzzleRepository} from './interfaces/IPuzzleRepository.js';
import type {IRoomRepository} from './interfaces/IRoomRepository.js';
import {PuzzleRepository} from './PuzzleRepository.js';
import {RoomRepository} from './RoomRepository.js';

/**
 * Container for all repository instances
 */
export interface Repositories {
  puzzle: IPuzzleRepository;
  game: IGameRepository;
  room: IRoomRepository;
  counters: ICountersRepository;
}

/**
 * Creates all repository instances with the given database pool
 * @param pool PostgreSQL connection pool
 * @returns Object containing all repository instances
 */
export function createRepositories(pool: Pool): Repositories {
  // Create repositories with dependencies
  const puzzleRepo = new PuzzleRepository(pool);
  const gameRepo = new GameRepository(pool, puzzleRepo);
  const roomRepo = new RoomRepository(pool);
  const countersRepo = new CountersRepository(pool);

  return {
    puzzle: puzzleRepo,
    game: gameRepo,
    room: roomRepo,
    counters: countersRepo,
  };
}

// Re-export interfaces for convenience
export type {IPuzzleRepository, IGameRepository, IRoomRepository, ICountersRepository};
export {PuzzleRepository, GameRepository, RoomRepository, CountersRepository};
