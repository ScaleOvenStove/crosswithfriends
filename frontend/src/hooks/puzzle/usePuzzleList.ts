/**
 * usePuzzleList - React Query hook for fetching puzzle list
 * Implements REQ-1: Real puzzle data integration
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { PuzzleListFilters, PuzzleListItem } from '@api/types';
import { puzzlesApi } from '@api/apiClient';

interface UsePuzzleListOptions {
  pageSize?: number;
  filters?: PuzzleListFilters;
  enabled?: boolean;
}

/**
 * Convert PuzzleListFilters to query parameters for the generated API
 */
function convertFiltersToQueryParams(filters?: PuzzleListFilters) {
  return {
    sizeMini: filters?.sizeFilter?.Mini ? 'true' : undefined,
    sizeStandard: filters?.sizeFilter?.Standard ? 'true' : undefined,
    nameOrTitle: filters?.nameOrTitleFilter,
  };
}

/**
 * Fetch a single page of puzzles
 */
export const usePuzzleList = (page: number = 0, options: UsePuzzleListOptions = {}) => {
  const { pageSize = 20, filters, enabled = true } = options;

  return useQuery({
    queryKey: ['puzzles', 'list', page, pageSize, filters],
    queryFn: async () => {
      const params = convertFiltersToQueryParams(filters);
      const result = await puzzlesApi.listPuzzles(
        page.toString(),
        pageSize.toString(),
        params.sizeMini,
        params.sizeStandard,
        params.nameOrTitle
      );
      return result;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  });
};

/**
 * Fetch puzzles with infinite scroll support
 */
export const useInfinitePuzzleList = (options: UsePuzzleListOptions = {}) => {
  const { pageSize = 20, filters, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: ['puzzles', 'infinite', pageSize, filters],
    queryFn: async ({ pageParam = 0 }) => {
      const params = convertFiltersToQueryParams(filters);
      return puzzlesApi.listPuzzles(
        (pageParam as number).toString(),
        pageSize.toString(),
        params.sizeMini,
        params.sizeStandard,
        params.nameOrTitle
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      // If the last page has fewer items than pageSize, we've reached the end
      if (lastPage.puzzles && lastPage.puzzles.length < pageSize) {
        return undefined;
      }
      return allPages.length;
    },
    initialPageParam: 0,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Transform puzzle list items for UI consumption
 */
export const transformPuzzleForDisplay = (puzzle: PuzzleListItem) => {
  const { pid, content, stats } = puzzle;

  // Handle both formats: ipuz (title/author at root) and old format (info.title/info.author)
  const contentAny = content as any;
  const title = content.title || contentAny?.info?.title || 'Untitled Puzzle';
  const author = content.author || contentAny?.info?.author || 'Unknown';

  // Calculate dimensions - use content.dimensions if available, otherwise calculate from solution
  let dimensions = { width: 0, height: 0 };
  if (content.dimensions) {
    dimensions = content.dimensions;
  } else if (content.solution && Array.isArray(content.solution) && content.solution.length > 0) {
    const firstRow = content.solution[0];
    dimensions = {
      height: content.solution.length,
      width: Array.isArray(firstRow) ? firstRow.length : 0,
    };
  }

  // Determine size - check content.info.type first (API-provided), then calculate from dimensions/solution
  let size = 'Standard';
  const infoType = contentAny?.info?.type;
  if (infoType) {
    // API provides 'Daily Puzzle' or 'Mini Puzzle', map to 'Standard' or 'Mini'
    size = infoType === 'Mini Puzzle' ? 'Mini' : 'Standard';
  } else if (dimensions.width > 0 && dimensions.height > 0) {
    size = dimensions.width <= 7 && dimensions.height <= 7 ? 'Mini' : 'Standard';
  }

  return {
    id: pid,
    title,
    author,
    size,
    dimensions,
    numSolves: stats?.numSolves || 0,
    content,
  };
};

export default usePuzzleList;
