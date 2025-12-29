/**
 * useReplayPlayback - Hook for managing replay playback state
 * Implements event replay with play/pause, seek, and speed control
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface GameEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

interface UseReplayPlaybackOptions {
  events: GameEvent[];
  onEventApply?: (event: GameEvent, index: number) => void;
  autoPlay?: boolean;
  initialSpeed?: number;
}

export const useReplayPlayback = ({
  events,
  onEventApply,
  autoPlay = false,
  initialSpeed = 1,
}: UseReplayPlaybackOptions) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(initialSpeed);
  const timerRef = useRef<number | null>(null);

  // Calculate interval based on speed and event timestamps
  const calculateInterval = useCallback(
    (index: number): number => {
      if (index >= events.length - 1) return 1000;

      const currentEvent = events[index];
      const nextEvent = events[index + 1];

      if (!currentEvent || !nextEvent) return 1000;

      const timeDiff = nextEvent.timestamp - currentEvent.timestamp;
      // Base interval scaled by speed, with min 100ms and max 5000ms
      return Math.min(Math.max(timeDiff / speed, 100), 5000);
    },
    [events, speed]
  );

  // Apply event at specific index
  const applyEvent = useCallback(
    (index: number) => {
      if (index < 0 || index >= events.length) return;

      const event = events[index];
      if (event && onEventApply) {
        onEventApply(event, index);
      }
    },
    [events, onEventApply]
  );

  // Play next event
  const playNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;

      if (nextIndex >= events.length) {
        setIsPlaying(false);
        return prev;
      }

      applyEvent(nextIndex);
      return nextIndex;
    });
  }, [events.length, applyEvent]);

  // Playback timer effect
  useEffect(() => {
    if (isPlaying && currentIndex < events.length - 1) {
      const interval = calculateInterval(currentIndex);
      timerRef.current = window.setTimeout(() => {
        playNext();
      }, interval);

      return () => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [isPlaying, currentIndex, events.length, calculateInterval, playNext]);

  // Control functions
  const play = useCallback(() => {
    if (currentIndex >= events.length - 1) {
      // If at the end, restart from beginning
      setCurrentIndex(0);
      applyEvent(0);
    }
    setIsPlaying(true);
  }, [currentIndex, events.length, applyEvent]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, events.length - 1));
      setCurrentIndex(clampedIndex);
      applyEvent(clampedIndex);
    },
    [events.length, applyEvent]
  );

  const skipBackward = useCallback(
    (amount: number = 10) => {
      seek(Math.max(0, currentIndex - amount));
    },
    [currentIndex, seek]
  );

  const skipForward = useCallback(
    (amount: number = 10) => {
      seek(Math.min(events.length - 1, currentIndex + amount));
    },
    [currentIndex, events.length, seek]
  );

  const restart = useCallback(() => {
    setCurrentIndex(0);
    applyEvent(0);
    setIsPlaying(false);
  }, [applyEvent]);

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  // Get current event
  const currentEvent = events[currentIndex] || null;

  return {
    currentIndex,
    currentEvent,
    totalEvents: events.length,
    isPlaying,
    speed,
    play,
    pause,
    togglePlayPause,
    seek,
    skipBackward,
    skipForward,
    restart,
    changeSpeed,
  };
};

export default useReplayPlayback;
