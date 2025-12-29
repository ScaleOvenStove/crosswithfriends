/**
 * Fencing Page - Competitive fencing mode
 * Players claim cells by filling them first - highest score wins
 */

import { useParams } from 'react-router-dom';
import { useUser } from '@hooks/index';
import { useBattleMode } from '@hooks/game/useBattleMode';
import Nav from '@components/common/Nav';
import BattleGrid from '@components/Battle/BattleGrid';
import ScoreBoard from '@components/Battle/ScoreBoard';
import { GameSkeleton } from '@components/common/skeletons';

const Fencing = () => {
  const { gid } = useParams<{ gid: string }>();
  const { user } = useUser();

  // Placeholder grid for demo
  const demoGrid = [
    ['', '', '', '', '#'],
    ['', '', '', '', ''],
    ['#', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '#', '', ''],
  ];

  const { players, leaderboard, cellOwnership, isGameActive, claimCell, getCellOwner } =
    useBattleMode({
      gameId: gid || '',
      mode: 'fencing',
    });

  const handleCellFill = (row: number, col: number, value: string) => {
    if (!user) return;

    const owner = getCellOwner(row, col);
    if (owner) {
      console.log('Cell already claimed by', owner);
      return;
    }

    // Attempt to claim the cell
    const claimed = claimCell(row, col, value, user.id);
    if (claimed) {
      console.log('Cell claimed:', row, col, value);
    }
  };

  if (!gid) {
    return (
      <div className="fencing-page">
        <Nav />
        <div className="container">
          <div className="error-message">Invalid game ID</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fencing-page">
        <Nav />
        <GameSkeleton />
      </div>
    );
  }

  return (
    <div className="fencing-page">
      <Nav />
      <div className="fencing-container">
        <header className="fencing-header">
          <div className="fencing-title-section">
            <h1>Fencing Mode</h1>
            <span className="beta-badge">BETA</span>
          </div>
          <p className="fencing-description">Claim cells first to score points!</p>
        </header>

        <div className="fencing-main">
          <div className="fencing-grid-section">
            <BattleGrid
              grid={demoGrid}
              cellOwnership={cellOwnership}
              players={players}
              currentPlayerId={user.id}
              mode="fencing"
              onCellFill={handleCellFill}
            />

            {!isGameActive && (
              <div className="game-status-overlay">
                <p>Waiting for game to start...</p>
              </div>
            )}
          </div>

          <aside className="fencing-sidebar">
            <ScoreBoard players={leaderboard} mode="fencing" currentPlayerId={user.id} />

            <div className="fencing-info">
              <h3>How to Play</h3>
              <ul>
                <li>Fill cells correctly to claim them</li>
                <li>Each claimed cell = 1 point</li>
                <li>Cells are color-coded by owner</li>
                <li>Highest score at the end wins</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Fencing;
