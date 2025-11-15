import type {ListPuzzleStatsRequest, ListPuzzleStatsResponse} from '@crosswithfriends/shared/types';

import apiClient from './client';

export async function fetchStats(query: ListPuzzleStatsRequest): Promise<ListPuzzleStatsResponse> {
  return apiClient.post<ListPuzzleStatsResponse>('/api/stats', query);
}
