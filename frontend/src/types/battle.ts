/**
 * Battle & Fencing Mode Types
 * Type definitions for competitive puzzle modes
 */

// ============================================================================
// Battle Mode
// ============================================================================

export interface BattleState {
  bid: string; // battle ID
  gid: string; // game ID
  pid: string; // puzzle ID
  status: 'waiting' | 'countdown' | 'active' | 'finished';
  startTime: number | null;
  endTime: number | null;
  players: BattlePlayer[];
}

export interface BattlePlayer {
  id: string;
  displayName: string;
  color: string;
  progress: number; // 0-100%
  completionTime: number | null; // milliseconds
  rank: number | null;
  isLocal: boolean;
}

export interface BattleLeaderboard {
  players: BattleLeaderboardEntry[];
}

export interface BattleLeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  completionTime: number;
  accuracy: number; // 0-100%
  checksUsed: number;
  revealsUsed: number;
}

// ============================================================================
// Fencing Mode
// ============================================================================

export interface FencingState {
  gid: string;
  status: 'waiting' | 'active' | 'finished';
  startTime: number | null;
  endTime: number | null;
  teams: FencingTeam[];
  cellOwnership: CellOwnership;
}

export interface FencingTeam {
  id: number;
  name: string;
  color: string;
  players: FencingPlayer[];
  score: number;
  cellsClaimed: number;
}

export interface FencingPlayer {
  id: string;
  displayName: string;
  teamId: number;
  cellsClaimed: number;
}

export interface CellOwnership {
  [cellKey: string]: {
    teamId: number;
    playerId: string;
    claimedAt: number;
  };
}

export interface FencingScoreBoard {
  teams: FencingTeamScore[];
  topPlayers: FencingPlayerScore[];
}

export interface FencingTeamScore {
  teamId: number;
  teamName: string;
  color: string;
  score: number;
  cellsClaimed: number;
  accuracy: number;
}

export interface FencingPlayerScore {
  playerId: string;
  displayName: string;
  teamId: number;
  cellsClaimed: number;
  score: number;
}

// ============================================================================
// Shared Competitive Types
// ============================================================================

export type CompetitiveMode = 'battle' | 'fencing';

export interface CompetitiveStats {
  mode: CompetitiveMode;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  averageTime: number;
  bestTime: number;
  accuracy: number;
}
