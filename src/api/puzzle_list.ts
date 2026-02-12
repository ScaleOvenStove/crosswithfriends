// ========== GET /api/puzzlelist ============

// eslint-disable-next-line import/no-extraneous-dependencies
import qs from 'qs';
import {ListPuzzleRequest, ListPuzzleResponse} from '../shared/types';
import {SERVER_URL} from './constants';

export async function fetchPuzzleList(
  query: ListPuzzleRequest,
  accessToken?: string | null
): Promise<ListPuzzleResponse> {
  const url = `${SERVER_URL}/api/puzzle_list?${qs.stringify(query)}`;
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const resp = await fetch(url, {headers});
  return resp.json();
}
