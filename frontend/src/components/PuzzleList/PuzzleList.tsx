import React, {useMemo} from 'react';
import _ from 'lodash';
import './css/puzzleList.css';
import NewPuzzleList from './NewPuzzleList';

interface PuzzleListProps {
  userHistory: any;
  search?: string;
  sizeFilter?: any;
  fencing?: boolean;
  statusFilter?: any;
  uploadedPuzzles?: any;
  onScroll?: () => void;
}

const PuzzleList: React.FC<PuzzleListProps> = ({
  userHistory,
  search,
  sizeFilter,
  fencing,
  statusFilter,
  uploadedPuzzles,
  onScroll,
}) => {
  const puzzleStatuses = useMemo(() => {
    const statuses: Record<string, 'solved' | 'started'> = {};
    function setStatus(pid: string, solved: boolean) {
      if (solved) {
        statuses[pid] = 'solved';
      } else if (!statuses[pid]) {
        statuses[pid] = 'started';
      }
    }

    _.keys(userHistory).forEach((gid) => {
      if (gid === 'solo') {
        _.keys(userHistory.solo).forEach((uid) => {
          const soloGames = userHistory.solo[uid];
          _.keys(soloGames).forEach((pid) => {
            const {solved} = soloGames[pid];
            setStatus(pid, solved);
          });
        });
      } else {
        const {pid, solved} = userHistory[gid];
        setStatus(pid, solved);
      }
    });

    return statuses;
  }, [userHistory]);

  const filter = useMemo(
    () => ({
      nameOrTitleFilter: search,
      sizeFilter,
    }),
    [search, sizeFilter]
  );

  return (
    <NewPuzzleList
      fencing={fencing}
      filter={filter}
      statusFilter={statusFilter}
      puzzleStatuses={puzzleStatuses}
      uploadedPuzzles={uploadedPuzzles}
      onScroll={onScroll}
    />
  );
};

export default React.memo(PuzzleList);
