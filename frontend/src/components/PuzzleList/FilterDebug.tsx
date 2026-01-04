/**
 * Filter Debug Component
 * Temporary component to help debug filter behavior
 * Shows current filter state and resulting API query
 */

import { useMemo } from 'react';
import type { PuzzleListFilters } from '@api/types';
import type { FilterState } from './FilterSidebar';

interface FilterDebugProps {
  filterState: FilterState;
  searchTerm: string;
  filters: PuzzleListFilters | undefined;
}

const FilterDebug = ({ filterState, searchTerm, filters }: FilterDebugProps) => {
  // Construct what the URL will look like
  const debugUrl = useMemo(() => {
    if (!filters) return 'No filters applied - fetching all puzzles';

    const params = new URLSearchParams({
      page: '0',
      pageSize: '20',
    });

    // Size filters
    if (filters.sizeFilter?.Mini !== undefined) {
      params.append('filter[sizeFilter][Mini]', filters.sizeFilter.Mini.toString());
    }
    if (filters.sizeFilter?.Standard !== undefined) {
      params.append('filter[sizeFilter][Standard]', filters.sizeFilter.Standard.toString());
    }

    // Status filters
    if (filters.statusFilter?.New !== undefined) {
      params.append('filter[statusFilter][New]', filters.statusFilter.New.toString());
    }
    if (filters.statusFilter?.InProgress !== undefined) {
      params.append('filter[statusFilter][InProgress]', filters.statusFilter.InProgress.toString());
    }
    if (filters.statusFilter?.Complete !== undefined) {
      params.append('filter[statusFilter][Complete]', filters.statusFilter.Complete.toString());
    }

    // Difficulty filters
    if (filters.difficultyFilter?.Easy !== undefined) {
      params.append('filter[difficultyFilter][Easy]', filters.difficultyFilter.Easy.toString());
    }
    if (filters.difficultyFilter?.Medium !== undefined) {
      params.append('filter[difficultyFilter][Medium]', filters.difficultyFilter.Medium.toString());
    }
    if (filters.difficultyFilter?.Hard !== undefined) {
      params.append('filter[difficultyFilter][Hard]', filters.difficultyFilter.Hard.toString());
    }

    // Text filters
    if (filters.nameOrTitleFilter) {
      params.append('filter[nameOrTitleFilter]', filters.nameOrTitleFilter);
    }
    if (filters.authorFilter) {
      params.append('filter[authorFilter]', filters.authorFilter);
    }

    // Date filters
    if (filters.dateAddedFrom) {
      params.append('filter[dateAddedFrom]', filters.dateAddedFrom);
    }
    if (filters.dateAddedTo) {
      params.append('filter[dateAddedTo]', filters.dateAddedTo);
    }

    return `/puzzle_list?${params.toString()}`;
  }, [filters]);

  return (
    <details className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <summary className="cursor-pointer font-semibold text-yellow-800 mb-2">
        🐛 Debug Info (Click to expand)
      </summary>

      <div className="space-y-4 mt-4 text-sm">
        {/* Filter State */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Current Filter State:</h4>
          <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto">
            {JSON.stringify(
              {
                searchTerm,
                size: filterState.size,
                status: filterState.status,
                difficulty: filterState.difficulty,
                author: filterState.author,
                dateFrom: filterState.dateFrom,
                dateTo: filterState.dateTo,
              },
              null,
              2
            )}
          </pre>
        </div>

        {/* Computed Filters */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Filters Sent to API:</h4>
          <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto">
            {filters ? JSON.stringify(filters, null, 2) : 'undefined (no filters)'}
          </pre>
        </div>

        {/* API URL */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">API Query URL:</h4>
          <pre className="bg-white p-3 rounded border border-gray-200 overflow-x-auto break-all">
            {debugUrl}
          </pre>
        </div>

        {/* Active Filters Summary */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Active Filters:</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            {!filterState.size.Mini && <li>Excluding Mini puzzles</li>}
            {!filterState.size.Standard && <li>Excluding Standard puzzles</li>}
            {!filterState.status.New && <li>Excluding New puzzles</li>}
            {!filterState.status.InProgress && <li>Excluding In Progress puzzles</li>}
            {!filterState.status.Complete && <li>Excluding Complete puzzles</li>}
            {!filterState.difficulty.Easy && <li>Excluding Easy puzzles</li>}
            {!filterState.difficulty.Medium && <li>Excluding Medium puzzles</li>}
            {!filterState.difficulty.Hard && <li>Excluding Hard puzzles</li>}
            {filterState.author && <li>Author filter: "{filterState.author}"</li>}
            {searchTerm && <li>Search term: "{searchTerm}"</li>}
            {filterState.dateFrom && <li>Date from: {filterState.dateFrom}</li>}
            {filterState.dateTo && <li>Date to: {filterState.dateTo}</li>}
          </ul>
        </div>
      </div>
    </details>
  );
};

export default FilterDebug;
