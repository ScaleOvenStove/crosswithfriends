/**
 * SolveHistory Component
 * Displays list of solved puzzles with details
 */

import { Link } from 'react-router-dom';

interface HistoryItem {
  puzzleId: string;
  gameId: string;
  title: string;
  size: string;
  dateSolved: string;
  solveTime: number;
  checkedSquareCount: number;
  revealedSquareCount: number;
}

interface SolveHistoryProps {
  history: HistoryItem[];
  limit?: number;
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const SolveHistory = ({ history, limit }: SolveHistoryProps) => {
  const displayedHistory = limit ? history.slice(0, limit) : history;

  if (history.length === 0) {
    return (
      <div className="solve-history-empty">
        <p>No puzzles solved yet.</p>
        <p>Start playing to see your history!</p>
      </div>
    );
  }

  return (
    <div className="solve-history">
      <div className="history-list">
        {displayedHistory.map((item) => (
          <div key={item.gameId} className="history-item">
            <div className="history-info">
              <Link to={`/replay/${item.gameId}`} className="history-title">
                {item.title}
              </Link>
              <div className="history-meta">
                <span className="history-size">{item.size}</span>
                <span className="history-date">{item.dateSolved}</span>
              </div>
            </div>

            <div className="history-stats">
              <div className="history-stat">
                <span className="stat-label">Time:</span>
                <span className="stat-value">{formatTime(item.solveTime)}</span>
              </div>
              {item.checkedSquareCount > 0 && (
                <div className="history-stat">
                  <span className="stat-label">Checked:</span>
                  <span className="stat-value">{item.checkedSquareCount}</span>
                </div>
              )}
              {item.revealedSquareCount > 0 && (
                <div className="history-stat">
                  <span className="stat-label">Revealed:</span>
                  <span className="stat-value">{item.revealedSquareCount}</span>
                </div>
              )}
            </div>

            <div className="history-actions">
              <Link to={`/replay/${item.gameId}`} className="btn-secondary btn-sm">
                Watch Replay
              </Link>
            </div>
          </div>
        ))}
      </div>

      {limit && history.length > limit && (
        <div className="history-show-more">
          <p>
            Showing {limit} of {history.length} puzzles
          </p>
        </div>
      )}
    </div>
  );
};

export default SolveHistory;
