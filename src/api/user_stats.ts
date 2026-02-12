import {SERVER_URL} from './constants';

export interface CoSolver {
  userId: string;
  displayName: string;
}

export interface SolveHistoryItem {
  pid: string;
  gid: string;
  title: string;
  size: string;
  time: number;
  solvedAt: string;
  playerCount: number;
  coSolvers: CoSolver[];
  anonCount: number;
}

export interface SizeStats {
  size: string;
  count: number;
  avgTime: number;
}

export interface UploadedPuzzle {
  pid: string;
  title: string;
  uploadedAt: string;
  timesSolved: number;
  size: string;
  isPublic: boolean;
}

export interface InProgressGame {
  gid: string;
  pid: string;
  title: string;
  size: string;
  lastActivity: string;
}

export interface UserStatsResponse {
  user: {
    displayName: string;
    createdAt: string;
  };
  stats: {
    totalSolved: number;
    bySize: SizeStats[];
  };
  history: SolveHistoryItem[];
  uploads: UploadedPuzzle[];
  inProgress: InProgressGame[];
}

export async function getUserStats(userId: string): Promise<UserStatsResponse | null> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/user-stats/${userId}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
