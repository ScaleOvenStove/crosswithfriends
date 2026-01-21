/**
 * Puzzle List Component
 * Implements REQ-3.1: Puzzle Discovery with real API integration
 */

import { useState, useMemo, useCallback } from 'react';
import { useInfinitePuzzleList, transformPuzzleForDisplay } from '@hooks/puzzle/usePuzzleList';
import { useFilterState } from '@hooks/ui/useFilterState';
import type { PuzzleListFilters } from '@api/types';
import LoadingSpinner from '@components/common/LoadingSpinner';
import PuzzleListItem from './PuzzleListItem';
import FilterSidebar from './FilterSidebar';
import FilterDebug from './FilterDebug';
import { Search as MagnifyingGlassIcon } from '@mui/icons-material';

// Enable debug mode with URL parameter: ?debug=1
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';

const PuzzleListComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { filterState, updateFilters } = useFilterState();

  // Construct filters object for API
  const filters: PuzzleListFilters | undefined = useMemo(() => {
    const hasSearch = searchTerm.trim().length > 0;
    const hasAuthorFilter = filterState.author.trim().length > 0;
    const hasDateFilter = filterState.dateFrom !== '' || filterState.dateTo !== '';

    // Check if size filter is non-default (not all selected)
    const hasSizeFilter = !filterState.size.Mini || !filterState.size.Standard;

    // Check if status filter is non-default (not all selected)
    const hasStatusFilter =
      !filterState.status.New || !filterState.status.InProgress || !filterState.status.Complete;

    // Check if difficulty filter is non-default (not all selected)
    const hasDifficultyFilter =
      !filterState.difficulty.Easy ||
      !filterState.difficulty.Medium ||
      !filterState.difficulty.Hard;

    // Only send filters if at least one is non-default
    const hasAnyFilter =
      hasSearch ||
      hasSizeFilter ||
      hasStatusFilter ||
      hasDifficultyFilter ||
      hasAuthorFilter ||
      hasDateFilter;

    if (!hasAnyFilter) {
      return undefined;
    }

    return {
      nameOrTitleFilter: searchTerm.trim() || undefined,
      sizeFilter: hasSizeFilter ? filterState.size : undefined,
      statusFilter: hasStatusFilter ? filterState.status : undefined,
      difficultyFilter: hasDifficultyFilter ? filterState.difficulty : undefined,
      authorFilter: hasAuthorFilter ? filterState.author.trim() : undefined,
      dateAddedFrom: filterState.dateFrom || undefined,
      dateAddedTo: filterState.dateTo || undefined,
    };
  }, [searchTerm, filterState]);

  // Fetch puzzles with infinite scroll
  const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfinitePuzzleList({ filters });

  // Flatten paginated data
  const puzzles = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) =>
      (page.puzzles || []).map((p: any) => transformPuzzleForDisplay(p))
    );
  }, [data]);

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleFilterChange = useCallback(
    (newFilters: typeof filterState) => {
      updateFilters(newFilters);
    },
    [updateFilters]
  );

  const toggleFilterSidebar = useCallback(() => {
    setIsFilterOpen((prev) => !prev);
  }, []);

  // Render loading/error states within the content area instead of replacing the entire component
  // to prevent focus loss in the search bar.

  return (
    <div className="flex gap-6 mt-8">
      {/* Filter Sidebar */}
      <FilterSidebar
        filters={filterState}
        onFilterChange={handleFilterChange}
        isOpen={isFilterOpen}
        onToggle={toggleFilterSidebar}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <h2
              className="text-3xl md:text-4xl font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
                background:
                  'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Available Puzzles
            </h2>
            <button
              type="button"
              onClick={toggleFilterSidebar}
              className="lg:hidden px-4 py-2 text-sm font-semibold border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Filters
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5" sx={{ color: 'text.secondary' }} />
            </div>
            <input
              type="text"
              placeholder="Search by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 transition-all shadow-sm hover:shadow-md"
              style={{ fontFamily: 'var(--font-display)' }}
            />
          </div>

          <p
            className="text-sm text-neutral-600 dark:text-neutral-400 italic"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {puzzles.length} puzzle{puzzles.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Debug Info */}
        {DEBUG_MODE && (
          <FilterDebug filterState={filterState} searchTerm={searchTerm} filters={filters} />
        )}

        {isLoading ? (
          <LoadingSpinner text="Loading puzzles..." />
        ) : error ? (
          <div className="text-center p-12 bg-white rounded-lg border border-red-300 text-red-600">
            <p className="mb-4">Failed to load puzzles. Please try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-primary hover:text-white hover:border-primary transition-all"
            >
              Retry
            </button>
          </div>
        ) : puzzles.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-lg border border-gray-300 shadow-sm">
            <p className="text-gray-600 mb-2 text-lg font-medium">No puzzles found</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {puzzles.map((puzzle, index) => (
                <div
                  key={puzzle.id}
                  style={{
                    animationDelay: `${Math.min(index * 0.1, 1)}s`,
                  }}
                >
                  <PuzzleListItem puzzle={puzzle} />
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isFetchingNextPage}
                  className="px-8 py-3.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold rounded-xl border-2 border-neutral-300 dark:border-neutral-600 hover:bg-primary hover:text-white hover:border-primary hover:shadow-deep transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load More Puzzles'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PuzzleListComponent;
