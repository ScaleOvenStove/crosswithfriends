/**
 * Battle Page - Competitive battle mode
 * Players race to complete the same puzzle - first to finish wins
 */

import { useParams } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useUser, useGame, useBattleMode } from '@hooks/index';
import { useSocket } from '@sockets/index';
import Nav from '@components/common/Nav';
import BattleGrid from '@components/Battle/BattleGrid';
import ScoreBoard from '@components/Battle/ScoreBoard';
import { GameSkeleton } from '@components/common/skeletons';

const Battle = () => {
  const { bid } = useParams<{ bid: string }>();
  const { user } = useUser();
  const { socket } = useSocket();
  const [showVictory, setShowVictory] = useState(false);

  // Load game state with puzzle data
  const { puzzle, cells, isLoading: gameLoading, error: gameError } = useGame(bid || '');

  // Battle mode hook
  const { players, leaderboard, cellOwnership, isGameActive, winner } = useBattleMode({
    gameId: bid || '',
    mode: 'battle',
    onGameComplete: () => {
      setShowVictory(true);
      setTimeout(() => setShowVictory(false), 5000);
    },
  });

  // Handle cell fill - broadcast to all players
  const handleCellFill = useCallback(
    (row: number, col: number, value: string) => {
      if (!user || !socket || !bid) return;

      // Emit cell update event for battle mode
      socket.emit('game_event', {
        gid: bid,
        type: 'updateCell',
        params: {
          row,
          col,
          value,
        },
        user: user.id,
        timestamp: Date.now(),
      });
    },
    [user, socket, bid]
  );

  // Convert cells to simple grid format for BattleGrid
  const grid = cells.map((row) => row.map((cell) => cell.value));

  if (!bid) {
    return (
      <div className="battle-page">
        <Nav />
        <div className="container">
          <div className="error-message">Invalid battle ID</div>
        </div>
      </div>
    );
  }

  if (!user || gameLoading) {
    return (
      <div className="battle-page">
        <Nav />
        <GameSkeleton />
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="battle-page">
        <Nav />
        <div className="container">
          <div className="error-message">
            <p>Failed to load battle: {gameError}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="battle-page">
      <Nav />
      <div className="battle-container">
        <header className="battle-header">
          <div className="battle-title-section">
            <h1>Battle Mode</h1>
            <span className="beta-badge">BETA</span>
          </div>
          {puzzle && (
            <div className="puzzle-info">
              <h2>{puzzle.title || 'Untitled Puzzle'}</h2>
              {puzzle.author && <p className="author">by {puzzle.author}</p>}
            </div>
          )}
          <p className="battle-description">Race to complete the puzzle first!</p>
        </header>

        {showVictory && winner && (
          <div className="victory-modal">
            <div className="victory-content">
              <h2>🎉 Victory! 🎉</h2>
              <p>{winner.displayName} completed the puzzle!</p>
            </div>
          </div>
        )}

        <div className="battle-main">
          <div className="battle-grid-section">
            {grid.length > 0 ? (
              <BattleGrid
                grid={grid}
                cellOwnership={cellOwnership}
                players={players}
                currentPlayerId={user.id}
                mode="battle"
                onCellFill={handleCellFill}
              />
            ) : (
              <div className="grid-loading">
                <p>Loading puzzle...</p>
              </div>
            )}

            {!isGameActive && (
              <div className="game-status-overlay">
                <p>Waiting for game to start...</p>
              </div>
            )}
          </div>

          <aside className="battle-sidebar">
            <ScoreBoard players={leaderboard} mode="battle" currentPlayerId={user.id} />

            <div className="battle-info">
              <h3>How to Play</h3>
              <ul>
                <li>Fill in the crossword puzzle</li>
                <li>First player to complete wins</li>
                <li>Watch opponent progress in real-time</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Battle;
