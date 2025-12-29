/**
 * Hook for game clock management
 * Isolated clock logic to prevent unnecessary re-renders
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from '@stores/gameStore';

interface UseGameClockReturn {
  elapsedTime: number;
  isRunning: boolean;
  startClock: () => void;
  pauseClock: () => void;
  resetClock: () => void;
}

/**
 * Isolated clock component hook
 * Only re-renders when clock state changes, not on every store update
 */
export function useGameClock(): UseGameClockReturn {
  // Use selector to only subscribe to clock-related state
  const clock = useGameStore((state) => state.clock);
  const startTime = useGameStore((state) => state.startTime);
  const {
    startClock: storeStartClock,
    pauseClock: storePauseClock,
    resetClock: storeResetClock,
  } = useGameStore();

  // Local tick state for forcing re-renders when running
  const [_tick, setTick] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate current elapsed time
  const elapsedTime = (() => {
    if (!clock.isRunning || !startTime) {
      return clock.elapsedTime;
    }
    const now = Date.now();
    const currentSessionSeconds = Math.floor((now - startTime) / 1000);
    return clock.elapsedTime + currentSessionSeconds;
  })();

  // Set up interval when clock is running
  useEffect(() => {
    if (clock.isRunning) {
      intervalRef.current = setInterval(() => {
        setTick((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [clock.isRunning]);

  // Clock control functions
  const startClock = useCallback(() => {
    storeStartClock();
  }, [storeStartClock]);

  const pauseClock = useCallback(() => {
    storePauseClock();
  }, [storePauseClock]);

  const resetClock = useCallback(() => {
    storeResetClock();
  }, [storeResetClock]);

  return {
    elapsedTime,
    isRunning: clock.isRunning,
    startClock,
    pauseClock,
    resetClock,
  };
}
