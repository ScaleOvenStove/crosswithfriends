import {useEffect, useState} from 'react';
import {MdAccessTime} from 'react-icons/md';
import {fetchPuzzleStats, PuzzleStats} from '../../api/puzzle';
import {formatMilliseconds} from '../Toolbar/Clock';
import './css/PuzzleStatsLine.css';

interface Props {
  pid: string;
}

export default function PuzzleStatsLine({pid}: Props) {
  const [stats, setStats] = useState<PuzzleStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPuzzleStats(pid).then((data) => {
      if (!cancelled) setStats(data);
    });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  if (!stats || stats.medianMs == null) return null;

  return (
    <div className="puzzle-stats-line" title={`Median across ${stats.sampleCount} solves`}>
      <MdAccessTime className="puzzle-stats-line--icon" />
      <span>Typical solve: {formatMilliseconds(stats.medianMs)}</span>
      <span className="puzzle-stats-line--sample">({stats.sampleCount} solves)</span>
    </div>
  );
}
