/**
 * Stats Page - User statistics and history with real API integration
 * Implements REQ-7: Stats page with /api/stats endpoint
 */

import Nav from '@components/common/Nav';
import { useUser } from '@hooks/index';
import { useStats } from '@hooks/useStats';
import StatCard from '@components/Stats/StatCard';
import SolveHistory from '@components/Stats/SolveHistory';
import { StatsSkeleton } from '@components/common/skeletons';

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};

const Stats = () => {
  const { user } = useUser();
  const { stats, history, aggregateStats, historyByDate, isLoading, error } = useStats();

  if (isLoading) {
    return (
      <div className="stats-page">
        <Nav />
        <StatsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-page">
        <Nav />
        <div className="container">
          <div className="error-message">
            <p>Failed to load statistics.</p>
            <p>Try completing some puzzles first!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-page">
      <Nav />
      <div className="container">
        <header className="stats-header">
          <h1>Statistics</h1>
          {user && <p className="user-name">{user.displayName}</p>}
        </header>

        {/* Overall Statistics */}
        <section className="stats-overview">
          <h2>Overall Performance</h2>
          <div className="stats-grid">
            <StatCard label="Puzzles Solved" value={aggregateStats.totalPuzzlesSolved} icon="🎯" />
            <StatCard
              label="Average Time"
              value={formatTime(aggregateStats.avgSolveTime)}
              icon="⏱️"
            />
            <StatCard
              label="Best Time"
              value={formatTime(aggregateStats.bestSolveTime)}
              icon="🏆"
            />
            <StatCard
              label="Avg Hints Used"
              value={aggregateStats.avgCheckedPerPuzzle.toFixed(1)}
              icon="💡"
              subtitle="checks per puzzle"
            />
          </div>
        </section>

        {/* Stats by Puzzle Size */}
        {stats.length > 0 && (
          <section className="stats-by-size">
            <h2>Performance by Size</h2>
            <div className="size-stats-list">
              {stats.map((stat) => (
                <div key={stat.size} className="size-stat-item">
                  <div className="size-stat-header">
                    <h3>{stat.size}</h3>
                    <span className="puzzle-count">{stat.nPuzzlesSolved} puzzles</span>
                  </div>
                  <div className="size-stat-details">
                    <div className="stat-detail">
                      <span className="label">Average:</span>
                      <span className="value">{formatTime(stat.avgSolveTime)}</span>
                    </div>
                    <div className="stat-detail">
                      <span className="label">Best:</span>
                      <span className="value">{formatTime(stat.bestSolveTime)}</span>
                    </div>
                    <div className="stat-detail">
                      <span className="label">Avg Checks:</span>
                      <span className="value">{stat.avgCheckedSquareCount.toFixed(1)}</span>
                    </div>
                    <div className="stat-detail">
                      <span className="label">Avg Reveals:</span>
                      <span className="value">{stat.avgRevealedSquareCount.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Activity Chart */}
        {historyByDate.length > 0 && (
          <section className="stats-activity">
            <h2>Activity Over Time</h2>
            <div className="activity-chart">
              <div className="chart-bars">
                {historyByDate.slice(-30).map((item) => (
                  <div key={item.date} className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{
                        height: `${Math.min((item.count / Math.max(...historyByDate.map((i) => i.count))) * 100, 100)}%`,
                      }}
                      title={`${item.date}: ${item.count} puzzle${item.count !== 1 ? 's' : ''}`}
                    />
                    <div className="chart-label">{item.date.slice(-5)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Solve History */}
        <section className="stats-history">
          <h2>Recent Solves</h2>
          <SolveHistory history={history} limit={10} />
        </section>
      </div>
    </div>
  );
};

export default Stats;
