import {SERVER_URL} from './constants';

export interface CoSolver {
  userId: string;
  displayName: string;
}

export interface SolveHistoryItem {
  pid: string;
  gid: string;
  title: string;
  originalTitle?: string;
  size: string;
  dow: string | null;
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

export interface DayOfWeekStats {
  day: string;
  count: number;
  avgTime: number;
}

export interface UploadedPuzzle {
  pid: string;
  title: string;
  originalTitle?: string;
  uploadedAt: string;
  timesSolved: number;
  size: string;
  isPublic: boolean;
}

export interface InProgressGame {
  gid: string;
  pid: string;
  title: string;
  originalTitle?: string;
  size: string;
  lastActivity: string;
  percentComplete: number;
}

export interface UserStatsResponse {
  user: {
    displayName: string;
    createdAt?: string;
  };
  isPrivate?: boolean;
  stats?: {
    totalSolved: number;
    totalSolvedSolo: number;
    totalSolvedCoop: number;
    bySize: SizeStats[];
    byDay: DayOfWeekStats[];
    bySizeSolo: SizeStats[];
    bySizeCoop: SizeStats[];
    byDaySolo: DayOfWeekStats[];
    byDayCoop: DayOfWeekStats[];
  };
  history?: SolveHistoryItem[];
  uploads?: UploadedPuzzle[];
  inProgress?: InProgressGame[];
}

export async function getUserStats(
  userId: string,
  accessToken?: string | null
): Promise<UserStatsResponse | null> {
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const resp = await fetch(`${SERVER_URL}/api/user-stats/${userId}`, {headers});
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
