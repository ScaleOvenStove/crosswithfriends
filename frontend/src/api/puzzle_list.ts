import apiClient from './client';
import type {ListPuzzleRequest, ListPuzzleResponse} from '@crosswithfriends/shared/types';

export async function fetchPuzzleList(query: ListPuzzleRequest): Promise<ListPuzzleResponse> {
  // Build query string manually to handle nested objects properly
  // Fastify's qs parser expects bracket notation: filter[sizeFilter][Mini]=true
  const baseParams = new URLSearchParams();
  baseParams.append('page', String(query.page));
  baseParams.append('pageSize', String(query.pageSize));

  // Add filter params using bracket notation (qs library format)
  if (query.filter) {
    if (query.filter.sizeFilter.Mini) {
      baseParams.append('filter[sizeFilter][Mini]', 'true');
    }
    if (query.filter.sizeFilter.Standard) {
      baseParams.append('filter[sizeFilter][Standard]', 'true');
    }
    if (query.filter.nameOrTitleFilter) {
      baseParams.append('filter[nameOrTitleFilter]', query.filter.nameOrTitleFilter);
    }
  }

  // Use the query string directly in the URL
  const url = `/api/puzzle_list?${baseParams.toString()}`;
  const data = await apiClient.get<ListPuzzleResponse>(url);

  // Ensure the response has the expected structure
  if (!data.puzzles) {
    throw new Error('Invalid response format: missing puzzles property');
  }
  return data;
}
