/**
 * URL-persisted filter state hook
 * Syncs filter state with URL query parameters for shareable links
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterState } from '@components/PuzzleList/FilterSidebar';

const defaultFilterState: FilterState = {
  size: { Mini: true, Standard: true },
  status: { New: true, InProgress: true, Complete: true },
  difficulty: { Easy: true, Medium: true, Hard: true },
  author: '',
  dateFrom: '',
  dateTo: '',
};

/**
 * Parse boolean from string (handles '1', 'true', 'false', '0')
 */
const parseBoolean = (value: string | null, defaultValue: boolean): boolean => {
  if (value === null) return defaultValue;
  return value === '1' || value === 'true';
};

/**
 * Hook to manage filter state with URL persistence
 */
export const useFilterState = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL or defaults
  const [filterState, setFilterState] = useState<FilterState>(() => {
    return {
      size: {
        Mini: parseBoolean(searchParams.get('size_mini'), true),
        Standard: parseBoolean(searchParams.get('size_standard'), true),
      },
      status: {
        New: parseBoolean(searchParams.get('status_new'), true),
        InProgress: parseBoolean(searchParams.get('status_inprogress'), true),
        Complete: parseBoolean(searchParams.get('status_complete'), true),
      },
      difficulty: {
        Easy: parseBoolean(searchParams.get('difficulty_easy'), true),
        Medium: parseBoolean(searchParams.get('difficulty_medium'), true),
        Hard: parseBoolean(searchParams.get('difficulty_hard'), true),
      },
      author: searchParams.get('author') || '',
      dateFrom: searchParams.get('date_from') || '',
      dateTo: searchParams.get('date_to') || '',
    };
  });

  // Update URL when filter state changes
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add params that differ from defaults
    if (!filterState.size.Mini) params.set('size_mini', '0');
    if (!filterState.size.Standard) params.set('size_standard', '0');

    if (!filterState.status.New) params.set('status_new', '0');
    if (!filterState.status.InProgress) params.set('status_inprogress', '0');
    if (!filterState.status.Complete) params.set('status_complete', '0');

    if (!filterState.difficulty.Easy) params.set('difficulty_easy', '0');
    if (!filterState.difficulty.Medium) params.set('difficulty_medium', '0');
    if (!filterState.difficulty.Hard) params.set('difficulty_hard', '0');

    if (filterState.author) params.set('author', filterState.author);
    if (filterState.dateFrom) params.set('date_from', filterState.dateFrom);
    if (filterState.dateTo) params.set('date_to', filterState.dateTo);

    // Update URL without triggering navigation
    setSearchParams(params, { replace: true });
  }, [filterState, setSearchParams]);

  const updateFilters = useCallback((newFilters: FilterState) => {
    setFilterState(newFilters);
  }, []);

  return {
    filterState,
    updateFilters,
  };
};
