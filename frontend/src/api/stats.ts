import apiClient from './client';
import type {ListPuzzleStatsRequest, ListPuzzleStatsResponse} from '@crosswithfriends/shared/types';

export async function fetchStats(query: ListPuzzleStatsRequest): Promise<ListPuzzleStatsResponse> {
  return apiClient.post<ListPuzzleStatsResponse>('/api/stats', query);
}
