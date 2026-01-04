/**
 * URL-persisted filter state hook
 * Uses use-query-params for type-safe URL query parameter management
 */

import { useQueryParams, StringParam, BooleanParam } from 'use-query-params';
import type { FilterState } from '@components/PuzzleList/FilterSidebar';

/**
 * Hook to manage filter state with URL persistence using use-query-params
 */
export const useFilterState = () => {
  const [queryParams, setQueryParams] = useQueryParams({
    // Size filters
    size_mini: BooleanParam,
    size_standard: BooleanParam,

    // Status filters
    status_new: BooleanParam,
    status_inprogress: BooleanParam,
    status_complete: BooleanParam,

    // Difficulty filters
    difficulty_easy: BooleanParam,
    difficulty_medium: BooleanParam,
    difficulty_hard: BooleanParam,

    // Text filters
    author: StringParam,
    date_from: StringParam,
    date_to: StringParam,
  });

  // Convert query params to FilterState format
  const filterState: FilterState = {
    size: {
      Mini: queryParams.size_mini ?? true,
      Standard: queryParams.size_standard ?? true,
    },
    status: {
      New: queryParams.status_new ?? true,
      InProgress: queryParams.status_inprogress ?? true,
      Complete: queryParams.status_complete ?? true,
    },
    difficulty: {
      Easy: queryParams.difficulty_easy ?? true,
      Medium: queryParams.difficulty_medium ?? true,
      Hard: queryParams.difficulty_hard ?? true,
    },
    author: queryParams.author ?? '',
    dateFrom: queryParams.date_from ?? '',
    dateTo: queryParams.date_to ?? '',
  };

  const updateFilters = (newFilters: FilterState) => {
    // Only set params that differ from defaults
    const updates: Record<string, boolean | string | null | undefined> = {};

    // Size filters - only set if not default (true)
    if (!newFilters.size.Mini) {
      updates.size_mini = false;
    } else {
      updates.size_mini = undefined; // Remove from URL if default
    }
    if (!newFilters.size.Standard) {
      updates.size_standard = false;
    } else {
      updates.size_standard = undefined;
    }

    // Status filters
    if (!newFilters.status.New) {
      updates.status_new = false;
    } else {
      updates.status_new = undefined;
    }
    if (!newFilters.status.InProgress) {
      updates.status_inprogress = false;
    } else {
      updates.status_inprogress = undefined;
    }
    if (!newFilters.status.Complete) {
      updates.status_complete = false;
    } else {
      updates.status_complete = undefined;
    }

    // Difficulty filters
    if (!newFilters.difficulty.Easy) {
      updates.difficulty_easy = false;
    } else {
      updates.difficulty_easy = undefined;
    }
    if (!newFilters.difficulty.Medium) {
      updates.difficulty_medium = false;
    } else {
      updates.difficulty_medium = undefined;
    }
    if (!newFilters.difficulty.Hard) {
      updates.difficulty_hard = false;
    } else {
      updates.difficulty_hard = undefined;
    }

    // Text filters
    updates.author = newFilters.author || undefined;
    updates.date_from = newFilters.dateFrom || undefined;
    updates.date_to = newFilters.dateTo || undefined;

    setQueryParams(updates, 'replace');
  };

  return {
    filterState,
    updateFilters,
  };
};
