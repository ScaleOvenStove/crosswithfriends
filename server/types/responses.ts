/**
 * Response type definitions for API endpoints
 * These types define the shape of successful API responses
 */

import type {PuzzleJson} from '@crosswithfriends/shared/types';

// ============================================================================
// Health Response
// ============================================================================

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

// ============================================================================
// Authentication Responses
// ============================================================================

export interface TokenResponse {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId?: string;
  expiresAt?: number;
}

export interface MeResponse {
  userId: string;
  expiresAt: number;
}

// ============================================================================
// Game Responses
// ============================================================================

export interface CreateGameResponse {
  gid: string;
}

export interface GetGameResponse {
  gid: string;
  pid: string;
  events: unknown[]; // GameEvent[]
  // Add other game fields as needed
}

export interface GetGamePuzzleResponse {
  puzzle: PuzzleJson;
}

// ============================================================================
// Puzzle Responses
// ============================================================================

export interface GetPuzzleResponse {
  pid: string;
  content: PuzzleJson;
  stats: {
    numSolves: number;
  };
}

export interface PuzzleListResponse {
  puzzles: Array<{
    pid: string;
    content: PuzzleJson;
    stats: {
      numSolves: number;
    };
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

export interface RecordSolveResponse {
  success: boolean;
  pid: string;
  numSolves: number;
}

// ============================================================================
// Counter Responses
// ============================================================================

export interface CounterResponse {
  value: number;
}

// ============================================================================
// Link Preview Responses
// ============================================================================

export interface LinkPreviewResponse {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export interface OEmbedResponse {
  type: 'rich' | 'photo' | 'video' | 'link';
  version: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  cache_age?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  width?: number;
  height?: number;
  url?: string;
}

// ============================================================================
// Stats Responses
// ============================================================================

export interface StatsResponse {
  solveTime?: number;
  totalSolves: number;
  // Add other stats fields as needed
}

// ============================================================================
// Error Responses
// ============================================================================

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
  retryAfter?: number;
  details?: unknown;
}

export interface ValidationErrorResponse extends ErrorResponse {
  error: 'Bad Request';
  details: Array<{
    instancePath?: string;
    message?: string;
    keyword?: string;
  }>;
}
