import _ from 'lodash';
import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import type {PuzzleJson, PuzzleStatsJson, ListPuzzleRequestFilters} from '@crosswithfriends/shared/types';
import {Box, Skeleton} from '@mui/material';
import {fetchPuzzleList} from '../../api/puzzle_list';
import './css/puzzleList.css';
import Entry from './Entry';
import type {EntryProps} from './Entry';

interface PuzzleStatuses {
  [pid: string]: 'solved' | 'started';
}
interface NewPuzzleListProps {
  filter: ListPuzzleRequestFilters;
  statusFilter: {
    Complete: boolean;
    'In progress': boolean;
    New: boolean;
  };
  puzzleStatuses: PuzzleStatuses;
  uploadedPuzzles: number;
  fencing?: boolean;
  onScroll?: (scrollTop: number) => void;
}

const NewPuzzleList: React.FC<NewPuzzleListProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fullyLoaded, setFullyLoaded] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;
  const [puzzles, setPuzzles] = useState<
    {
      pid: string;
      content: PuzzleJson;
      stats: PuzzleStatsJson;
    }[]
  >([]);

  // Use refs to avoid stale closures
  const filterRef = useRef(props.filter);
  const puzzlesRef = useRef(puzzles);
  const pageRef = useRef(page);
  const loadingRef = useRef(loading);

  // Update refs when values change
  useEffect(() => {
    filterRef.current = props.filter;
  }, [props.filter]);

  useEffect(() => {
    puzzlesRef.current = puzzles;
  }, [puzzles]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Memoize filter for comparison to avoid unnecessary re-renders
  const filterKey = useMemo(
    () =>
      `${props.filter.nameOrTitleFilter}-${props.filter.sizeFilter.Mini}-${props.filter.sizeFilter.Standard}`,
    [props.filter.nameOrTitleFilter, props.filter.sizeFilter.Mini, props.filter.sizeFilter.Standard]
  );

  const fullyScrolled = (): boolean => {
    if (!containerRef.current) return false;
    const {scrollTop, scrollHeight, clientHeight} = containerRef.current;
    const buffer = 600; // 600 pixels of buffer, i guess?
    return scrollTop + clientHeight + buffer > scrollHeight;
  };

  const fetchMore = useCallback(
    async (currentPuzzles: typeof puzzles, currentPage: number, currentFilter: ListPuzzleRequestFilters) => {
      if (loadingRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const nextPage = await fetchPuzzleList({page: currentPage, pageSize, filter: currentFilter});
        // Defensive check: ensure puzzles array exists
        const puzzlesArray = nextPage?.puzzles || [];
        setPuzzles([...currentPuzzles, ...puzzlesArray]);
        setPage(currentPage + 1);
        setFullyLoaded(_.size(puzzlesArray) < pageSize);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load puzzles';
        setError(errorMessage);
        console.error('Error fetching puzzles:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Throttled version of fetchMore
  const throttledFetchMore = useMemo(
    () =>
      _.throttle(
        async (
          currentPuzzles: typeof puzzles,
          currentPage: number,
          currentFilter: ListPuzzleRequestFilters
        ) => {
          await fetchMore(currentPuzzles, currentPage, currentFilter);
        },
        500,
        {trailing: true}
      ),
    [fetchMore]
  );

  // Reset and fetch when filters change
  useEffect(() => {
    setPuzzles([]);
    setPage(0);
    setFullyLoaded(false);
    setError(null);
    fetchMore([], 0, props.filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, props.uploadedPuzzles]);

  const handleScroll = useCallback(async () => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    if (props.onScroll) {
      props.onScroll(scrollTop);
    }

    if (fullyLoaded || loadingRef.current) return;
    if (fullyScrolled()) {
      await throttledFetchMore(puzzlesRef.current, pageRef.current, filterRef.current);
    }
  }, [fullyLoaded, throttledFetchMore, props.onScroll]);

  const handleTouchEnd = useCallback(async () => {
    if (!containerRef.current) return;
    await handleScroll();
  }, [handleScroll]);

  const puzzleData: {
    entryProps: EntryProps;
  }[] = useMemo(
    () =>
      puzzles
        .map((puzzle) => ({
          entryProps: {
            info: {
              type: puzzle.content.info.type || 'Puzzle',
            },
            title: puzzle.content.info.title,
            author: puzzle.content.info.author,
            pid: puzzle.pid,
            stats: puzzle.stats,
            status: props.puzzleStatuses[puzzle.pid],
            fencing: props.fencing,
          },
        }))
        .filter((data) => {
          const mappedStatus = {
            undefined: 'New' as const,
            solved: 'Complete' as const,
            started: 'In progress' as const,
          }[data.entryProps.status];
          return props.statusFilter[mappedStatus];
        }),
    [puzzles, props.puzzleStatuses, props.statusFilter, props.fencing]
  );

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        overflowY: 'auto',
        height: '100%',
        flex: 1,
      }}
      className="puzzlelist"
      onScroll={handleScroll}
      onTouchEnd={handleTouchEnd}
    >
      {error && (
        <div style={{width: '100%', padding: '20px', textAlign: 'center', color: '#d32f2f'}}>
          Error loading puzzles: {error}
        </div>
      )}
      {!error && puzzleData.length === 0 && !loading && (
        <div style={{width: '100%', padding: '20px', textAlign: 'center', color: '#666'}}>
          No puzzles found matching your filters.
        </div>
      )}
      {puzzleData.map(({entryProps}) => (
        <div className="entry--container" key={entryProps.pid}>
          <Entry {...entryProps} />
        </div>
      ))}
      {loading && (
        <Box sx={{width: '100%', p: 2}}>
          {Array.from({length: 3}).map((_, i) => (
            <Box key={i} sx={{mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1}}>
              <Skeleton variant="text" width="60%" height={24} sx={{mb: 1}} />
              <Skeleton variant="text" width="80%" height={32} sx={{mb: 1}} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
          ))}
        </Box>
      )}
    </div>
  );
};

export default NewPuzzleList;
