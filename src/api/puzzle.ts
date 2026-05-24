import {SERVER_URL} from './constants';
import {
  AddPuzzleRequest,
  AddPuzzleResponse,
  InfoJson,
  RecordSolveRequest,
  RecordSolveResponse,
} from '../shared/types';

export async function createNewPuzzle(
  puzzle: AddPuzzleRequest,
  pid: string | undefined,
  opts: {isPublic?: boolean; accessToken?: string | null} = {}
): Promise<AddPuzzleResponse> {
  const url = `${SERVER_URL}/api/puzzle`;
  const data = {
    puzzle,
    pid,
    isPublic: !!opts.isPublic,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }
  const body = JSON.stringify(data);
  const sizeKb = Math.ceil(body.length / 1024);
  const MAX_SIZE_KB = 1024;
  const sizeError = `Puzzle is too large to upload (${sizeKb} KB). Maximum size is 1 MB.`;
  if (sizeKb > MAX_SIZE_KB) {
    throw new Error(sizeError);
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  if (!resp.ok) {
    if (resp.status === 413) {
      throw new Error(sizeError);
    }
    const text = await resp.text().catch(() => '');
    throw new Error(text || `Upload failed (${resp.status})`);
  }
  return resp.json();
}

export async function fetchPuzzleInfo(pid: number): Promise<InfoJson | null> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/puzzle/${pid}/info`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export type PuzzleStats = {
  sampleCount: number;
  medianMs: number | null;
};

export async function fetchPuzzleStats(pid: string | number): Promise<PuzzleStats | null> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/puzzle/${pid}/stats`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function recordSolve(
  pid: string,
  gid: string,
  time_to_solve: number,
  accessToken?: string | null,
  playerCount?: number,
  snapshot?: object,
  dfacId?: string
): Promise<RecordSolveResponse> {
  const url = `${SERVER_URL}/api/record_solve/${pid}`;
  const data: RecordSolveRequest = {
    gid,
    time_to_solve,
    player_count: playerCount,
    snapshot,
    dfacId,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return resp.json();
}
