/**
 * Playback Controls Component for Replay System
 * Provides play/pause, speed control, and skip functionality
 */

import { useState } from 'react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onRestart: () => void;
  disabled?: boolean;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4];

const PlaybackControls = ({
  isPlaying,
  speed,
  onPlayPause,
  onSpeedChange,
  onSkipBackward,
  onSkipForward,
  onRestart,
  disabled = false,
}: PlaybackControlsProps) => {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const handleSpeedClick = () => {
    setShowSpeedMenu(!showSpeedMenu);
  };

  const handleSpeedSelect = (newSpeed: number) => {
    onSpeedChange(newSpeed);
    setShowSpeedMenu(false);
  };

  return (
    <div className={`playback-controls ${disabled ? 'disabled' : ''}`}>
      {/* Restart Button */}
      <button
        type="button"
        onClick={onRestart}
        disabled={disabled}
        className="control-btn restart-btn"
        aria-label="Restart"
        title="Restart from beginning"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
        </svg>
      </button>

      {/* Skip Backward */}
      <button
        type="button"
        onClick={onSkipBackward}
        disabled={disabled}
        className="control-btn skip-btn"
        aria-label="Skip backward"
        title="Skip backward 10 events"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
        </svg>
      </button>

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        className="control-btn play-pause-btn"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Skip Forward */}
      <button
        type="button"
        onClick={onSkipForward}
        disabled={disabled}
        className="control-btn skip-btn"
        aria-label="Skip forward"
        title="Skip forward 10 events"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
        </svg>
      </button>

      {/* Speed Control */}
      <div className="speed-control">
        <button
          type="button"
          onClick={handleSpeedClick}
          disabled={disabled}
          className="control-btn speed-btn"
          aria-label="Playback speed"
          title="Playback speed"
        >
          {speed}×
        </button>

        {showSpeedMenu && (
          <div className="speed-menu">
            {SPEED_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => handleSpeedSelect(option)}
                className={`speed-option ${speed === option ? 'active' : ''}`}
              >
                {option}×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaybackControls;
