import _ from 'lodash';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {PuzzleJson, PuzzleStatsJson, ListPuzzleRequestFilters} from '../../shared/types';
import {fetchPuzzleList} from '../../api/puzzle_list';
import {getUserStats} from '../../api/user_stats';
import AuthContext from '../../lib/AuthContext';
import './css/puzzleList.css';
import Entry, {EntryProps} from './Entry';

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
}

const NewPuzzleList: React.FC<NewPuzzleListProps> = (props) => {
  const {accessToken, user} = useContext(AuthContext) as {
    accessToken: string | null;
    user: {id: string} | null;
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch solve statuses from PostgreSQL for authenticated users (cross-device support)
  const [pgStatuses, setPgStatuses] = useState<PuzzleStatuses>({});
  useEffect(() => {
    if (!user?.id || !accessToken) {
      setPgStatuses({});
      return;
    }
    getUserStats(user.id, accessToken).then((stats) => {
      if (!stats) return;
      const statuses: PuzzleStatuses = {};
      (stats.history || []).forEach((item) => {
        statuses[item.pid] = 'solved';
      });
      (stats.inProgress || []).forEach((item) => {
        if (!statuses[item.pid]) statuses[item.pid] = 'started';
      });
      setPgStatuses(statuses);
    });
  }, [user?.id, accessToken]);

  // Merge Firebase statuses with PostgreSQL statuses (PG takes precedence for 'solved')
  const mergedStatuses = useMemo(() => {
    const merged = {...props.puzzleStatuses};
    Object.entries(pgStatuses).forEach(([pid, status]) => {
      if (status === 'solved' || !merged[pid]) {
        merged[pid] = status;
      }
    });
    return merged;
  }, [props.puzzleStatuses, pgStatuses]);
  const [fullyLoaded, setFullyLoaded] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const pageSize = 50;
  const [puzzles, setPuzzles] = useState<
    {
      pid: string;
      content: PuzzleJson;
      stats: PuzzleStatsJson;
      isPublic?: boolean;
    }[]
  >([]);
  const fullyScrolled = useCallback((): boolean => {
    if (!containerRef.current) return false;
    const {scrollTop, scrollHeight, clientHeight} = containerRef.current;
    const buffer = 600; // 600 pixels of buffer, i guess?
    return scrollTop + clientHeight + buffer > scrollHeight;
  }, []);

  const fetchMore = React.useCallback(
    _.throttle(
      async (
        currentPuzzles: {
          pid: string;
          content: PuzzleJson;
          stats: PuzzleStatsJson;
          isPublic?: boolean;
        }[],
        currentPage: number
      ) => {
        if (loading) return;
        setLoading(true);
        const nextPage = await fetchPuzzleList(
          {page: currentPage, pageSize, filter: props.filter},
          accessToken
        );
        setPuzzles([...currentPuzzles, ...nextPage.puzzles]);
        setPage(currentPage + 1);
        setLoading(false);
        setFullyLoaded(_.size(nextPage.puzzles) < pageSize);
      },
      500,
      {trailing: true}
    ),
    [loading, JSON.stringify(props.filter), accessToken]
  );
  useEffect(() => {
    // it is debatable if we want to blank out the current puzzles here or not,
    // for now we only change the puzzles when the reload happens.
    fetchMore([], 0);
  }, [JSON.stringify(props.filter), props.uploadedPuzzles, !!accessToken]);

  const handleScroll = useCallback(async () => {
    if (fullyLoaded) return;
    if (fullyScrolled()) {
      await fetchMore(puzzles, page);
    }
  }, [fullyLoaded, fullyScrolled, fetchMore, puzzles, page]);
  const handleTouchEnd = useCallback(async () => {
    if (containerRef.current) return;
    await handleScroll();
  }, [handleScroll]);

  const puzzleData: {
    entryProps: EntryProps;
  }[] = puzzles
    .map((puzzle) => ({
      entryProps: {
        info: {
          type: puzzle.content.info.type!, // XXX not the best form
        },
        grid: puzzle.content.grid,
        title: puzzle.content.info.title,
        author: puzzle.content.info.author,
        pid: puzzle.pid,
        stats: puzzle.stats,
        status: mergedStatuses[puzzle.pid],
        fencing: props.fencing,
        isPublic: puzzle.isPublic,
      },
    }))
    .filter((data) => {
      const mappedStatus = {
        undefined: 'New' as const,
        solved: 'Complete' as const,
        started: 'In progress' as const,
      }[data.entryProps.status];
      return props.statusFilter[mappedStatus];
    });
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        overflowY: 'auto',
      }}
      className="puzzlelist"
      onScroll={handleScroll}
      onTouchEnd={handleTouchEnd}
    >
      {puzzleData.map(({entryProps}) => (
        <div className="entry--container" key={entryProps.pid}>
          <Entry
            info={entryProps.info}
            grid={entryProps.grid}
            title={entryProps.title}
            author={entryProps.author}
            pid={entryProps.pid}
            stats={entryProps.stats}
            status={entryProps.status}
            fencing={entryProps.fencing}
            isPublic={entryProps.isPublic}
          />
        </div>
      ))}
    </div>
  );
};

export default NewPuzzleList;
