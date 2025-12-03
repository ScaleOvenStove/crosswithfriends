import type {PuzzleJson, PuzzleStatsJson, ListPuzzleRequestFilters} from '@crosswithfriends/shared/types';
import {Box, Skeleton, Button, Typography} from '@mui/material';
import {useVirtualizer} from '@tanstack/react-virtual';
import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';

import {fetchPuzzleList} from '../../api/puzzle_list';
import {logger} from '../../utils/logger';
import {throttle} from '../../utils/throttle';

import './css/puzzleList.css';
import Entry from './Entry';
import type {EntryProps} from './Entry';

// Cell component - extracted for better performance
interface CellProps {
  style: React.CSSProperties;
  ariaAttributes: {'aria-colindex': number; role: 'gridcell'};
  itemData: {entryProps: EntryProps} | null;
  spacing: number;
  isFocused: boolean;
}

const Cell: React.FC<CellProps> = React.memo(({style, ariaAttributes, itemData, spacing, isFocused}) => {
  return (
    <div
      style={style}
      className="entry--container"
      role={ariaAttributes.role}
      aria-colindex={ariaAttributes['aria-colindex']}
      // tabIndex is required for keyboard navigation in grid cells (role="gridcell" makes it interactive)
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
    >
      {itemData ? (
        <div
          style={{
            margin: `${spacing / 2}px`,
            width: `calc(100% - ${spacing}px)`,
            height: `calc(100% - ${spacing}px)`,
            position: 'relative',
            zIndex: 1,
            outline: isFocused ? '2px solid #1976d2' : 'none',
            outlineOffset: '2px',
          }}
        >
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <Entry {...itemData.entryProps} />
        </div>
      ) : null}
    </div>
  );
});
Cell.displayName = 'Cell';

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
  // Destructure props early to avoid dependency issues
  const {filter, fencing, onScroll: onScrollProp} = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
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

  // Virtual scrolling configuration
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const itemSpacing = 25; // Spacing between items
  const itemHeight = 120; // Height of each entry item
  const itemWidth = 300; // Width of each entry item
  const totalItemHeight = itemHeight + itemSpacing; // Total height including spacing
  const totalItemWidth = itemWidth + itemSpacing; // Total width including spacing

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const announcementRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndexRef = useRef<number | null>(null);

  // Memoize filter for comparison using deep comparison approach
  const filterKey = useMemo(() => {
    const nameFilter = props.filter.nameOrTitleFilter || '';
    const mini = props.filter.sizeFilter?.Mini ? '1' : '0';
    const standard = props.filter.sizeFilter?.Standard ? '1' : '0';
    return `${nameFilter}-${mini}-${standard}`;
  }, [props.filter.nameOrTitleFilter, props.filter.sizeFilter?.Mini, props.filter.sizeFilter?.Standard]);

  // Update container size on resize and initial mount
  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) {
      return undefined;
    }

    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        // Only update if size actually changed to avoid unnecessary re-renders
        setContainerSize((prev) => {
          if (prev.width !== width || prev.height !== height) {
            return {width, height};
          }
          return prev;
        });
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updateSize();
    });

    // Also try immediately in case RAF is too late
    updateSize();

    window.addEventListener('resize', updateSize);

    // Use ResizeObserver for more reliable size tracking
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(containerElement);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateSize);
      if (resizeObserver && containerElement) {
        resizeObserver.unobserve(containerElement);
        resizeObserver.disconnect();
      }
    };
  }, []);

  const fullyScrolled = (scrollTop: number, scrollHeight: number, clientHeight: number): boolean => {
    const buffer = 600; // 600 pixels of buffer
    return scrollTop + clientHeight + buffer > scrollHeight;
  };

  const fetchMore = useCallback(
    async (currentPuzzles: typeof puzzles, currentPage: number, currentFilter: ListPuzzleRequestFilters) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const nextPage = await fetchPuzzleList({page: currentPage, pageSize, filter: currentFilter});
        // Defensive check: ensure puzzles array exists
        const puzzlesArray = nextPage?.puzzles || [];
        const newPuzzles = [...currentPuzzles, ...puzzlesArray];
        setPuzzles(newPuzzles);
        setPage(currentPage + 1);
        setFullyLoaded(puzzlesArray.length < pageSize);

        // Announce to screen readers
        if (puzzlesArray.length > 0) {
          setAnnouncement(`Loaded ${puzzlesArray.length} more puzzles. Total: ${newPuzzles.length}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load puzzles';
        setError(errorMessage);
        logger.errorWithException('Error fetching puzzles', err);
        setAnnouncement(`Error loading puzzles: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    },
    [loading, pageSize]
  );

  // Throttled version of fetchMore
  const throttledFetchMore = useMemo(
    () =>
      throttle(
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
    setFocusedIndex(null);
    focusedIndexRef.current = null;
    fetchMore([], 0, filter);
    setAnnouncement('Loading puzzles...');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, props.uploadedPuzzles, filter]);

  const handleScroll = useCallback(
    async ({
      scrollTop,
      scrollHeight,
      clientHeight,
    }: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
    }) => {
      if (fullyLoaded || loading) return;
      if (fullyScrolled(scrollTop, scrollHeight, clientHeight)) {
        await throttledFetchMore(puzzles, page, filter);
      }
    },
    [fullyLoaded, loading, throttledFetchMore, puzzles, page, filter]
  );

  // Handle retry on error
  const handleRetry = useCallback(() => {
    setError(null);
    setPuzzles([]);
    setPage(0);
    setFullyLoaded(false);
    setAnnouncement('Retrying to load puzzles...');
    fetchMore([], 0, filter);
  }, [fetchMore, filter]);

  const puzzleData: {
    entryProps: EntryProps;
  }[] = useMemo(
    () =>
      puzzles
        .map((puzzle) => {
          // Handle both ipuz format (title/author at root) and transformed format (info object)
          const content = puzzle.content;
          const isIpuzFormat = content.title !== undefined && !('info' in content);

          let info: {type: string; title?: string; author?: string; copyright?: string; description?: string};
          let title: string;
          let author: string;

          if (isIpuzFormat) {
            // ipuz format: title/author at root level
            const solution = content.solution || [];
            const type = solution.length > 10 ? 'Daily Puzzle' : 'Mini Puzzle';
            info = {type};
            title = content.title || '';
            author = content.author || '';
          } else {
            // Transformed format: info object exists (old format or API-transformed)
            const contentWithInfo = content as PuzzleJson & {
              info?: {
                type?: string;
                title?: string;
                author?: string;
                copyright?: string;
                description?: string;
              };
            };
            const existingInfo = contentWithInfo.info;
            info = {
              type: existingInfo?.type || 'Puzzle',
              title: existingInfo?.title,
              author: existingInfo?.author,
              copyright: existingInfo?.copyright,
              description: existingInfo?.description,
            };
            title = existingInfo?.title || '';
            author = existingInfo?.author || '';
          }

          return {
            entryProps: {
              info,
              title,
              author,
              pid: puzzle.pid,
              stats: puzzle.stats,
              status: props.puzzleStatuses[puzzle.pid],
              fencing: props.fencing,
            },
          };
        })
        .filter((data) => {
          const status = data.entryProps.status;
          let mappedStatus: 'Complete' | 'In progress' | 'New';
          if (status === 'solved') {
            mappedStatus = 'Complete';
          } else if (status === 'started') {
            mappedStatus = 'In progress';
          } else {
            mappedStatus = 'New';
          }
          return props.statusFilter[mappedStatus];
        }),
    [puzzles, props.puzzleStatuses, props.statusFilter, props.fencing]
  );

  // Virtual scrolling calculations (after puzzleData is defined)
  const columnCount = useMemo(() => {
    if (containerSize.width === 0) return 1;
    return Math.max(1, Math.floor(containerSize.width / totalItemWidth));
  }, [containerSize.width, totalItemWidth]);
  const rowCount = useMemo(() => {
    return Math.ceil(puzzleData.length / columnCount);
  }, [puzzleData.length, columnCount]);

  // TanStack Virtual row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => totalItemHeight,
    overscan: 5,
  });

  // Get item data for a specific index
  const getItemData = useCallback(
    (index: number) => {
      return puzzleData[index] || null;
    },
    [puzzleData]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (puzzleData.length === 0) return;

      const currentIndex = focusedIndexRef.current ?? 0;
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIndex = Math.min(currentIndex + 1, puzzleData.length - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(currentIndex + columnCount, puzzleData.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(currentIndex - columnCount, 0);
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = puzzleData.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0 && currentIndex < puzzleData.length) {
            const item = getItemData(currentIndex);
            if (item) {
              // Navigate to the puzzle
              window.location.href = `/beta/play/${item.entryProps.pid}${fencing ? '?fencing=1' : ''}`;
            }
          }
          return;
        default:
          return;
      }

      if (newIndex !== currentIndex) {
        setFocusedIndex(newIndex);
        focusedIndexRef.current = newIndex;
        // Scroll item into view if needed
        if (parentRef.current) {
          const targetRow = Math.floor(newIndex / columnCount);
          const virtualRow = rowVirtualizer.getVirtualItems().find((item) => item.index === targetRow);
          if (virtualRow) {
            virtualRow.element?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
          } else {
            // If row not in view, scroll to it
            const scrollTop = targetRow * totalItemHeight;
            parentRef.current.scrollTop = scrollTop;
          }
        }
        const item = getItemData(newIndex);
        if (item) {
          setAnnouncement(`Focused on puzzle: ${item.entryProps.title || 'Untitled'}`);
        }
      }
    },
    [puzzleData.length, columnCount, getItemData, fencing, rowVirtualizer]
  );

  // Update focused index ref when state changes
  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // Handle scroll events
  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      handleScroll({scrollTop, scrollHeight, clientHeight});
      if (onScrollProp) {
        onScrollProp(scrollTop);
      }
    },
    [handleScroll, onScrollProp]
  );

  // Update announcement when puzzle count changes
  useEffect(() => {
    if (puzzleData.length > 0 && !loading && !error) {
      setAnnouncement(`Displaying ${puzzleData.length} puzzle${puzzleData.length === 1 ? '' : 's'}`);
    }
  }, [puzzleData.length, loading, error]);

  // Error state with retry
  if (error) {
    return (
      <Box
        role="alert"
        aria-live="assertive"
        sx={{
          width: '100%',
          padding: '20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h6" sx={{color: '#d32f2f', mb: 1}}>
          Error loading puzzles
        </Typography>
        <Typography variant="body1" sx={{color: '#666', mb: 2}}>
          {error}
        </Typography>
        <Button variant="contained" onClick={handleRetry} aria-label="Retry loading puzzles">
          Retry
        </Button>
        <div
          ref={announcementRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden'}}
        >
          {announcement}
        </div>
      </Box>
    );
  }

  // Empty state
  if (!error && puzzleData.length === 0 && !loading) {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{
          width: '100%',
          padding: '20px',
          textAlign: 'center',
          color: '#666',
        }}
      >
        <Typography variant="body1" sx={{mb: 1}}>
          No puzzles found matching your filters.
        </Typography>
        <Typography variant="body2" sx={{color: '#999'}}>
          Try adjusting your search or filter criteria.
        </Typography>
        <div
          ref={announcementRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden'}}
        >
          {announcement}
        </div>
      </Box>
    );
  }

  // Show skeleton during initial load (when container size is 0 or loading with no data)
  const showInitialSkeleton =
    containerSize.width === 0 || containerSize.height === 0 || (loading && puzzles.length === 0);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        flex: 1,
        position: 'relative',
      }}
      className="puzzlelist"
      role="region"
      aria-label="Puzzle list"
    >
      {/* Screen reader announcements */}
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden'}}
      >
        {announcement}
      </div>

      {showInitialSkeleton ? (
        <Box
          role="status"
          aria-label="Loading puzzles"
          aria-busy="true"
          sx={{
            width: '100%',
            height: '100%',
            p: 2,
            overflow: 'auto',
          }}
        >
          {Array.from({length: 6}, (_, i) => (
            <Box
              key={`loading-skeleton-${i}`}
              sx={{mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1}}
            >
              <Skeleton variant="text" width="60%" height={24} sx={{mb: 1}} />
              <Skeleton variant="text" width="80%" height={32} sx={{mb: 1}} />
              <Skeleton variant="text" width="40%" height={20} />
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {containerSize.width > 0 && containerSize.height > 0 && (
            <div
              ref={parentRef}
              onKeyDown={handleKeyDown}
              onScroll={onScroll}
              tabIndex={0}
              role="grid"
              aria-label="Puzzle grid"
              aria-rowcount={rowCount}
              aria-colcount={columnCount}
              style={{
                width: '100%',
                height: '100%',
                outline: 'none',
                overflow: 'auto',
              }}
            >
              <div
                style={{
                  width: `${columnCount * totalItemWidth}px`,
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                    }}
                  >
                    {Array.from({length: columnCount}, (_, columnIndex) => {
                      const index = virtualRow.index * columnCount + columnIndex;
                      if (index >= puzzleData.length) return null;
                      const item = getItemData(index);
                      const isFocused = focusedIndex === index;

                      return (
                        <div
                          key={columnIndex}
                          style={{
                            width: `${totalItemWidth}px`,
                            height: '100%',
                            flexShrink: 0,
                          }}
                        >
                          <Cell
                            style={{
                              width: '100%',
                              height: '100%',
                            }}
                            ariaAttributes={{
                              'aria-colindex': columnIndex + 1,
                              role: 'gridcell',
                            }}
                            itemData={item}
                            spacing={itemSpacing}
                            isFocused={isFocused}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading && puzzles.length > 0 && (
            <Box
              role="status"
              aria-label="Loading more puzzles"
              aria-busy="true"
              sx={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                p: 2,
                backgroundColor: 'background.paper',
              }}
            >
              {Array.from({length: 3}, (_, i) => (
                <Box
                  key={`loading-more-skeleton-${i}`}
                  sx={{mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1}}
                >
                  <Skeleton variant="text" width="60%" height={24} sx={{mb: 1}} />
                  <Skeleton variant="text" width="80%" height={32} sx={{mb: 1}} />
                  <Skeleton variant="text" width="40%" height={20} />
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(NewPuzzleList);
