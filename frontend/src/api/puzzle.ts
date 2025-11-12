import apiClient from './client';
import type {
  AddPuzzleRequest,
  AddPuzzleResponse,
  RecordSolveRequest,
  RecordSolveResponse,
} from '@crosswithfriends/shared/types';

export async function createNewPuzzle(
  puzzle: AddPuzzleRequest,
  pid: string | undefined,
  opts: {isPublic?: boolean} = {}
): Promise<AddPuzzleResponse> {
  return apiClient.post<AddPuzzleResponse>('/api/puzzle', {
    puzzle,
    pid,
    isPublic: !!opts.isPublic,
  });
}

export async function recordSolve(
  pid: string,
  gid: string,
  time_to_solve: number
): Promise<RecordSolveResponse> {
  return apiClient.post<RecordSolveResponse>(`/api/record_solve/${pid}`, {
    gid,
    time_to_solve,
  });
}
