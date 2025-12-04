/**
 * ScoreBoard Component
 * Displays real-time leaderboard for Battle and Fencing modes
 */

interface Player {
  id: string;
  displayName: string;
  color: string;
  score: number;
  completedCells: number;
  isFinished: boolean;
}

interface ScoreBoardProps {
  players: Player[];
  mode: 'battle' | 'fencing';
  currentPlayerId?: string;
}

const ScoreBoard = ({ players, mode, currentPlayerId }: ScoreBoardProps) => {
  return (
    <div className="scoreboard">
      <h3 className="scoreboard-title">
        {mode === 'battle' ? 'Battle Standings' : 'Fencing Leaderboard'}
      </h3>

      <div className="scoreboard-list">
        {players.map((player, index) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const rank = index + 1;

          return (
            <div
              key={player.id}
              className={`scoreboard-item ${isCurrentPlayer ? 'current-player' : ''} ${
                player.isFinished ? 'finished' : ''
              }`}
              style={{ borderLeftColor: player.color }}
            >
              <div className="scoreboard-rank">
                {rank === 1 && '🥇'}
                {rank === 2 && '🥈'}
                {rank === 3 && '🥉'}
                {rank > 3 && rank}
              </div>

              <div className="scoreboard-player">
                <div className="player-color-indicator" style={{ backgroundColor: player.color }} />
                <span className="player-name">
                  {player.displayName}
                  {isCurrentPlayer && ' (You)'}
                </span>
              </div>

              <div className="scoreboard-stats">
                {mode === 'fencing' && <span className="player-score">{player.score} pts</span>}
                <span className="player-cells">{player.completedCells} cells</span>
                {player.isFinished && <span className="player-status finished">✓ Finished</span>}
              </div>
            </div>
          );
        })}
      </div>

      {players.length === 0 && (
        <div className="scoreboard-empty">
          <p>Waiting for players to join...</p>
        </div>
      )}
    </div>
  );
};

export default ScoreBoard;
