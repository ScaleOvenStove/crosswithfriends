import {useEffect, useState} from 'react';
import {MdAccessTime} from 'react-icons/md';
import * as Sentry from '@sentry/react';
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
    // Clear stale stats so an in-app navigation between puzzles doesn't
    // flash the previous puzzle's median while the new fetch is pending.
    // Chat (which renders us) is mounted without a key in pages/Game.js,
    // so the same component instance is reused across pid changes.
    setStats(null);
    fetchPuzzleStats(pid)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        Sentry.captureException(err);
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
