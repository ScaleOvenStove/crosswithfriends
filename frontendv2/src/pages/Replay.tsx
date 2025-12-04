/**
 * Replay Page - Game replay viewer with full playback controls
 * Implements REQ-5.1: Game Replay with Timeline and Event Synchronization
 */

import { useParams } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '@sockets/index';
import Nav from '@components/common/Nav';
import { ReplaySkeleton } from '@components/common/skeletons';
import Timeline from '@components/Replay/Timeline';
import PlaybackControls from '@components/Replay/PlaybackControls';
import Grid from '@components/Grid/Grid';
import { useReplayPlayback } from '@hooks/ui/useReplayPlayback';
import type { Cell } from '@types/index';
import '@components/Replay/Replay.css';

interface GameEvent {
  type: string;
  timestamp: number;
  id?: string;
  row?: number;
  col?: number;
  value?: string;
  [key: string]: unknown;
}

const Replay = () => {
  const { gid } = useParams<{ gid: string }>();
  const { socket, isConnected } = useSocket();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<{ title?: string; author?: string } | null>(null);
  const [gridSize, setGridSize] = useState<{ width: number; height: number }>({ width: 15, height: 15 });
  const [cells, setCells] = useState<Cell[][]>([]);

  // Fetch game events via socket
  useEffect(() => {
    if (!socket || !isConnected || !gid) return;

    setIsLoading(true);
    setError(null);

    // Join game room
    socket.emit('join_game', gid, (response: { success?: boolean; error?: string }) => {
      if (response.error) {
        setError(response.error);
        setIsLoading(false);
        return;
      }

      // Sync all game events
      socket.emit('sync_all_game_events', gid, (eventData: GameEvent[] | { error?: string }) => {
        if (Array.isArray(eventData)) {
          setEvents(eventData);
          setIsLoading(false);
        } else if (eventData.error) {
          setError(eventData.error);
          setIsLoading(false);
        }
      });
    });

    return () => {
      socket.emit('leave_game', gid);
    };
  }, [socket, isConnected, gid]);

  // Initialize empty grid
  useEffect(() => {
    const emptyCells: Cell[][] = Array(gridSize.height)
      .fill(null)
      .map(() =>
        Array(gridSize.width)
          .fill(null)
          .map(() => ({
            value: '',
            isPencil: false,
            isBlack: false,
            hasCircle: false,
          }))
      );
    setCells(emptyCells);
  }, [gridSize]);

  // Event application callback - rebuilds grid state from events
  const handleEventApply = useCallback(
    (event: GameEvent, index: number) => {
      if (event.type === 'updateCell' && typeof event.row === 'number' && typeof event.col === 'number') {
        setCells((prevCells) => {
          const newCells = prevCells.map((row) => row.map((cell) => ({ ...cell })));

          if (newCells[event.row!] && newCells[event.row!][event.col!]) {
            newCells[event.row!][event.col!] = {
              ...newCells[event.row!][event.col!],
              value: event.value || '',
              isPencil: event.isPencil === true,
            };
          }

          return newCells;
        });
      }
    },
    []
  );

  // Replay playback hook
  const {
    currentIndex,
    currentEvent,
    totalEvents,
    isPlaying,
    speed,
    togglePlayPause,
    seek,
    skipBackward,
    skipForward,
    restart,
    changeSpeed,
  } = useReplayPlayback({
    events,
    onEventApply: handleEventApply,
    autoPlay: false,
    initialSpeed: 1,
  });

  // Reset grid when restarting replay
  useEffect(() => {
    if (currentIndex === 0) {
      const emptyCells: Cell[][] = Array(gridSize.height)
        .fill(null)
        .map(() =>
          Array(gridSize.width)
            .fill(null)
            .map(() => ({
              value: '',
              isPencil: false,
              isBlack: false,
              hasCircle: false,
            }))
        );
      setCells(emptyCells);
    }
  }, [currentIndex, gridSize]);

  if (!gid) {
    return (
      <div className="replay-page">
        <Nav />
        <div className="container">
          <div className="error-message">Invalid game ID</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="replay-page">
        <Nav />
        <ReplaySkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="replay-page">
        <Nav />
        <div className="container">
          <div className="error-message">
            <p>Failed to load replay: {error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="replay-page">
        <Nav />
        <div className="container">
          <div className="empty-state">
            <p>No events found for this game.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="replay-page">
      <Nav />
      <div className="replay-container">
        <header className="replay-header">
          <h1>Replay</h1>
          <p>Game ID: {gid}</p>
          {gameInfo && (
            <div className="game-info">
              <p className="puzzle-title">{gameInfo.title}</p>
              <p className="puzzle-author">by {gameInfo.author}</p>
            </div>
          )}
        </header>

        <main className="replay-main">
          <div className="replay-grid-container">
            <div className="replay-grid-wrapper">
              <div className="replay-event-info">
                <span>
                  Event {currentIndex + 1} of {totalEvents}
                </span>
                {currentEvent && (
                  <span className="event-type-badge">{currentEvent.type}</span>
                )}
              </div>
              {cells.length > 0 ? (
                <Grid
                  cells={cells}
                  selectedCell={null}
                  selectedDirection="across"
                  currentUser={null}
                  users={[]}
                  onCellClick={() => {}} // Read-only in replay mode
                  onCellChange={() => {}}
                  onDirectionToggle={() => {}}
                />
              ) : (
                <div className="replay-grid-placeholder">
                  <p>Loading grid...</p>
                </div>
              )}
            </div>
          </div>

          <div className="replay-controls-container">
            <PlaybackControls
              isPlaying={isPlaying}
              speed={speed}
              onPlayPause={togglePlayPause}
              onSpeedChange={changeSpeed}
              onSkipBackward={() => skipBackward(10)}
              onSkipForward={() => skipForward(10)}
              onRestart={restart}
              disabled={events.length === 0}
            />

            <Timeline
              currentEventIndex={currentIndex}
              totalEvents={totalEvents}
              onSeek={seek}
              disabled={events.length === 0}
            />
          </div>
        </main>

        <aside className="replay-sidebar">
          <h3>Event Log</h3>
          <div className="event-log">
            {events.slice(Math.max(0, currentIndex - 5), currentIndex + 6).map((event, idx) => {
              const absoluteIndex = Math.max(0, currentIndex - 5) + idx;
              const isCurrent = absoluteIndex === currentIndex;

              return (
                <div
                  key={absoluteIndex}
                  className={`event-item ${isCurrent ? 'current' : ''}`}
                  onClick={() => seek(absoluteIndex)}
                >
                  <span className="event-index">{absoluteIndex + 1}</span>
                  <span className="event-type">{event.type}</span>
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Replay;
