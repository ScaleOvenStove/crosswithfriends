/**
 * Type definitions for API requests and responses
 */

// Re-export types from shared package
export type {
  AddPuzzleRequest,
  AddPuzzleResponse,
  CreateGameRequest,
  CreateGameResponse,
  ListPuzzleRequest,
  ListPuzzleResponse,
  ListPuzzleStatsRequest,
  ListPuzzleStatsResponse,
  RecordSolveRequest,
  RecordSolveResponse,
  IncrementGidResponse,
  IncrementPidResponse,
} from '@crosswithfriends/shared/types';

// API error response
export interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
}

