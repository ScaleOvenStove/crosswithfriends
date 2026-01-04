/**
 * Service Factory and Registry
 * Central place to create and access all services
 */

import type {Repositories} from '../repositories/index.js';

import {PuzzleService} from './PuzzleService.js';

/**
 * Container for all service instances
 */
export interface Services {
  puzzle: PuzzleService;
}

/**
 * Creates all service instances with the given repositories
 * @param repositories Repository instances
 * @returns Object containing all service instances
 */
export function createServices(repositories: Repositories): Services {
  return {
    puzzle: new PuzzleService(repositories.puzzle),
  };
}
