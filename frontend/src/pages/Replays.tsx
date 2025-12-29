/**
 * Replays Page - List of game replays
 * Implements REQ-5.2: Replay List
 */

import { useParams, Link } from 'react-router-dom';
import { useMemo } from 'react';
import Nav from '@components/common/Nav';
import { ListSkeleton } from '@components/common/skeletons';
import { useStats } from '@hooks';
import './Replays.css';

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

const Replays = () => {
  const { pid } = useParams<{ pid?: string }>();
  const { history, isLoading } = useStats();

  // Filter by puzzle ID if provided
  const replays = useMemo(() => {
    const filteredHistory = pid ? history.filter((item) => item.puzzleId === pid) : history;

    // Sort by date, most recent first
    return filteredHistory
      .sort((a, b) => b.dateSolved.localeCompare(a.dateSolved))
      .map((item) => ({
        id: item.gameId,
        puzzleTitle: item.title || 'Untitled Puzzle',
        date: item.dateSolved,
        duration: formatDuration(item.solveTime),
        size: item.size,
        checkedSquares: item.checkedSquareCount,
        revealedSquares: item.revealedSquareCount,
      }));
  }, [history, pid]);

  return (
    <div className="replays-page">
      <Nav />
      <div className="container">
        <header className="replays-header">
          <h1>Game Replays</h1>
          {pid && <p>Showing replays for puzzle: {pid}</p>}
        </header>

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : replays.length === 0 ? (
          <div className="empty-state">
            <p>No replays available yet.</p>
            <p className="text-muted">Complete some puzzles to see your solve history here!</p>
            <Link to="/" className="btn-primary">
              Play a Puzzle
            </Link>
          </div>
        ) : (
          <div className="replays-list">
            {replays.map((replay) => (
              <Link key={replay.id} to={`/replay/${replay.id}`} className="replay-item">
                <div className="replay-info">
                  <h3>{replay.puzzleTitle}</h3>
                  <div className="replay-meta">
                    <span className="replay-date">📅 {replay.date}</span>
                    <span className="replay-duration">⏱ {replay.duration}</span>
                    <span className="replay-size">📏 {replay.size}</span>
                    {replay.revealedSquares > 0 && (
                      <span className="replay-revealed">💡 {replay.revealedSquares} revealed</span>
                    )}
                    {replay.checkedSquares > 0 && (
                      <span className="replay-checked">✓ {replay.checkedSquares} checked</span>
                    )}
                  </div>
                </div>
                <button type="button" className="btn-secondary">
                  Watch Replay →
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Replays;
