/**
 * Request type definitions for API endpoints
 * These types define the shape of request bodies, query parameters, and route parameters
 */

import type {ListPuzzleRequestFilters} from '@crosswithfriends/shared/types';

// ============================================================================
// Authentication Requests
// ============================================================================

export interface CreateTokenRequest {
  userId?: string;
}

export interface ValidateTokenRequest {
  token: string;
}

export interface FirebaseTokenRequest {
  firebaseToken: string;
}

// ============================================================================
// Game Requests
// ============================================================================

export interface CreateGameRequest {
  gid: string;
  pid: string;
}

export interface GetGameParams {
  gid: string;
}

export interface GetGamePuzzleParams {
  gid: string;
}

// ============================================================================
// Puzzle Requests
// ============================================================================

export interface GetPuzzleParams {
  pid: string;
}

export interface RecordSolveParams {
  pid: string;
}

export interface PuzzleListRequest {
  filter?: ListPuzzleRequestFilters;
  page?: number;
  pageSize?: number;
  nameFilter?: string;
}

// ============================================================================
// Counter Requests
// ============================================================================

export interface GetCounterByGidParams {
  gid: string;
}

export interface GetCounterByPidParams {
  pid: string;
}

// ============================================================================
// Link Preview Requests
// ============================================================================

export interface LinkPreviewQuery {
  url: string;
}

export interface OEmbedQuery {
  url: string;
  format?: 'json' | 'xml';
  maxwidth?: number;
  maxheight?: number;
}

// ============================================================================
// Stats Requests
// ============================================================================

export interface StatsQuery {
  gid?: string;
  pid?: string;
}
