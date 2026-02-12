import {SERVER_URL} from './constants';
import {AddPuzzleRequest, AddPuzzleResponse, RecordSolveRequest, RecordSolveResponse} from '../shared/types';

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
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return resp.json();
}

export async function recordSolve(
  pid: string,
  gid: string,
  time_to_solve: number,
  accessToken?: string | null,
  playerCount?: number
): Promise<RecordSolveResponse> {
  const url = `${SERVER_URL}/api/record_solve/${pid}`;
  const data: RecordSolveRequest = {
    gid,
    time_to_solve,
    player_count: playerCount,
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
