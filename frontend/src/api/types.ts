/**
 * API Types - Generated from OpenAPI specification
 */

// ============================================================================
// Request Types
// ============================================================================

export interface CreateGameRequest {
  gid: string;
  pid: string;
}

export interface AddPuzzleRequest {
  puzzle: PuzzleJson;
  pid?: string;
  isPublic: boolean;
}

export interface RecordSolveRequest {
  gid: string;
  time_to_solve: number;
}

export interface ListPuzzleStatsRequest {
  gids: string[];
}

export interface PuzzleListFilters {
  sizeFilter?: {
    Mini?: boolean;
    Standard?: boolean;
  };
  statusFilter?: {
    New?: boolean;
    InProgress?: boolean;
    Complete?: boolean;
  };
  difficultyFilter?: {
    Easy?: boolean;
    Medium?: boolean;
    Hard?: boolean;
  };
  nameOrTitleFilter?: string;
  authorFilter?: string;
  dateAddedFrom?: string; // ISO date string
  dateAddedTo?: string; // ISO date string
}

// ============================================================================
// Response Types
// ============================================================================

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface CreateGameResponse {
  gid: string;
}

export interface GetGameResponse {
  gid: string;
  pid: string;
  title: string;
  author: string;
  duration: number;
  size: string;
}

export interface AddPuzzleResponse {
  pid: string;
}

export interface RecordSolveResponse {
  // Empty response
}

export interface IncrementGidResponse {
  gid: string;
}

export interface IncrementPidResponse {
  pid: string;
}

export interface OEmbedResponse {
  type: string;
  version: string;
  author_name: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
  retryAfter?: number;
}

// ============================================================================
// Puzzle Types
// ============================================================================

export interface IpuzCell {
  cell: number;
  style?: {
    shapebg?: string;
    fillbg?: string;
  };
}

export type PuzzleCell = number | string | IpuzCell | null;

export interface PuzzleClue {
  number: string;
  clue: string;
}

export type ClueFormat = [string, string] | PuzzleClue;

export interface PuzzleJson {
  version: string;
  kind: string[];
  dimensions: {
    width: number;
    height: number;
  };
  title: string;
  author: string;
  copyright?: string;
  notes?: string;
  solution: Array<Array<string | null>>;
  puzzle: Array<Array<PuzzleCell>>;
  clues: {
    Across: ClueFormat[];
    Down: ClueFormat[];
  };
}

export interface PuzzleStatsJson {
  numSolves: number;
}

export interface PuzzleListItem {
  pid: string;
  content: PuzzleJson;
  stats: PuzzleStatsJson;
}

export interface ListPuzzleResponse {
  puzzles: PuzzleListItem[];
}

// ============================================================================
// Stats Types
// ============================================================================

export interface PuzzleSizeStats {
  size: string;
  nPuzzlesSolved: number;
  avgSolveTime: number;
  bestSolveTime: number;
  bestSolveTimeGameId: string;
  avgCheckedSquareCount: number;
  avgRevealedSquareCount: number;
}

export interface PuzzleHistoryItem {
  puzzleId: string;
  gameId: string;
  title: string;
  size: string;
  dateSolved: string;
  solveTime: number;
  checkedSquareCount: number;
  revealedSquareCount: number;
}

export interface ListPuzzleStatsResponse {
  stats: PuzzleSizeStats[];
  history: PuzzleHistoryItem[];
}
