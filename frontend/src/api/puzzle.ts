import {SERVER_URL} from './constants';
import {
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
  const url = `${SERVER_URL}/api/puzzle`;
  const data = {
    puzzle,
    pid,
    isPublic: !!opts.isPublic,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return resp.json();
}

export async function recordSolve(
  pid: string,
  gid: string,
  time_to_solve: number
): Promise<RecordSolveResponse> {
  const url = `${SERVER_URL}/api/record_solve/${pid}`;
  const data: RecordSolveRequest = {
    gid,
    time_to_solve,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    let errorMessage = `Failed to record solve: ${resp.status} ${resp.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      // If response isn't JSON, use the text as-is
      if (errorText) {
        errorMessage = errorText;
      }
    }
    throw new Error(errorMessage);
  }

  return resp.json();
}
