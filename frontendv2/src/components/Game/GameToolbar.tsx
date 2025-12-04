/**
 * Game Toolbar Component
 * Implements REQ-1.3: Game Tools
 */

interface GameToolbarProps {
  isPencilMode: boolean;
  isComplete: boolean;
  clockTime: number;
  isClockRunning: boolean;
  onTogglePencil: () => void;
  onStartClock: () => void;
  onPauseClock: () => void;
  onResetClock: () => void;
  onCheck?: () => void;
  onReveal?: () => void;
  onReset?: () => void;
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const displaySeconds = seconds % 60;
  const displayMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}:${displayMinutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
  }
  return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;
};

const GameToolbar = ({
  isPencilMode,
  isComplete,
  clockTime,
  isClockRunning,
  onTogglePencil,
  onStartClock,
  onPauseClock,
  onResetClock,
  onCheck,
  onReveal,
  onReset,
}: GameToolbarProps) => {
  return (
    <div className="game-toolbar">
      <div className="toolbar-section">
        <div className="clock-display">
          <span className="clock-time">{formatTime(clockTime)}</span>
          <button
            onClick={isClockRunning ? onPauseClock : onStartClock}
            className="btn-icon"
            title={isClockRunning ? 'Pause' : 'Start'}
          >
            {isClockRunning ? '⏸' : '▶️'}
          </button>
          <button onClick={onResetClock} className="btn-icon" title="Reset">
            ↻
          </button>
        </div>
      </div>

      <div className="toolbar-section">
        <button
          onClick={onTogglePencil}
          className={`btn-tool ${isPencilMode ? 'active' : ''}`}
          title="Pencil Mode"
        >
          ✏️ {isPencilMode ? 'Pencil' : 'Normal'}
        </button>

        {onCheck && (
          <button onClick={onCheck} className="btn-tool" title="Check">
            ✓ Check
          </button>
        )}

        {onReveal && (
          <button onClick={onReveal} className="btn-tool" title="Reveal">
            💡 Reveal
          </button>
        )}

        {onReset && (
          <button onClick={onReset} className="btn-tool" title="Reset">
            🔄 Reset
          </button>
        )}
      </div>

      {isComplete && (
        <div className="completion-banner">🎉 Puzzle Complete! Time: {formatTime(clockTime)}</div>
      )}
    </div>
  );
};

export default GameToolbar;
