import apiClient from './client';
import type {ListPuzzleRequest, ListPuzzleResponse} from '@crosswithfriends/shared/types';

export async function fetchPuzzleList(query: ListPuzzleRequest): Promise<ListPuzzleResponse> {
  const data = await apiClient.get<ListPuzzleResponse>('/api/puzzle_list', {
    params: query as Record<string, string | number | boolean>,
  });
  // Ensure the response has the expected structure
  if (!data.puzzles) {
    throw new Error('Invalid response format: missing puzzles property');
  }
  return data;
}
