import './css/clock.css';
import {MAX_CLOCK_INCREMENT} from '@crosswithfriends/shared/lib/timing';
import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';

import {getTime} from '../../store/firebase';

export const formatMilliseconds = (ms: number): string => {
  function pad2(num: number): string {
    let s = `${100}${num}`;
    s = s.substr(s.length - 2);
    return s;
  }
  let secs = Math.floor(ms / 1000);
  let mins = Math.floor(secs / 60);
  secs %= 60;
  const hours = Math.floor(mins / 60);
  mins %= 60;

  return `${(hours ? `${hours}:` : '') + pad2(mins)}:${pad2(secs)}`;
};

interface Props {
  pausedTime?: number;
  startTime?: number;
  stopTime?: number;
  replayMode?: boolean;
  isPaused?: boolean;
  v2?: boolean;
  onStart?: () => void;
  onPause?: () => void;
}

const Clock: React.FC<Props> = ({
  pausedTime,
  startTime,
  stopTime,
  replayMode,
  isPaused: propsIsPaused,
  v2,
  onStart,
  onPause,
}) => {
  const [clock, setClock] = useState('00:00');
  const lastVisibleTimeRef = useRef<number | null>(null);
  const wasCappedRef = useRef(false);

  // Track page visibility to detect when page goes to background
  useEffect(() => {
    if (!v2 || replayMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page went to background - record the time
        lastVisibleTimeRef.current = getTime();
      } else {
        // Page came back to foreground - check if we need to pause
        if (lastVisibleTimeRef.current && startTime && !propsIsPaused) {
          const now = getTime();
          const timeSinceLastVisible = now - lastVisibleTimeRef.current;
          // If more than 1 minute passed while in background, we should be capped
          if (timeSinceLastVisible > MAX_CLOCK_INCREMENT) {
            // Auto-pause if timer was running and we've been away too long
            if (onPause) {
              onPause();
            }
          }
        }
        lastVisibleTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [v2, replayMode, startTime, propsIsPaused, onPause]);

  const isCapped = useMemo(() => {
    if (!v2) return false;
    if (!startTime) return false;
    const now = getTime();
    return now > startTime + MAX_CLOCK_INCREMENT;
  }, [v2, startTime]);

  // Auto-pause when timer becomes capped
  useEffect(() => {
    if (isCapped && !propsIsPaused && !replayMode && onPause && !wasCappedRef.current) {
      wasCappedRef.current = true;
      onPause();
    } else if (!isCapped) {
      wasCappedRef.current = false;
    }
  }, [isCapped, propsIsPaused, replayMode, onPause]);

  const isPaused = useMemo(() => {
    if (replayMode) return false;
    // to this component, there's no difference between capped & paused
    return propsIsPaused || isCapped;
  }, [replayMode, propsIsPaused, isCapped]);

  const updateClock = useCallback(() => {
    const now = getTime();

    let clockMs = 0;

    if (startTime && !replayMode && !propsIsPaused) {
      // Timer is running
      if (stopTime) {
        // Finished - use the stop time
        clockMs = (pausedTime || 0) + (stopTime - startTime);
      } else {
        // Calculate elapsed time since startTime, but cap it at MAX_CLOCK_INCREMENT
        // This prevents the timer from showing more than 1 minute when page was in background
        const elapsed = now - startTime;
        const cappedElapsed = Math.min(elapsed, MAX_CLOCK_INCREMENT);

        // pausedTime is the accumulated time from previous sessions (from clock.totalTime)
        // We add the capped elapsed time from the current session
        clockMs = (pausedTime || 0) + cappedElapsed;
      }
    } else {
      // Timer is paused - use pausedTime directly (which is clock.totalTime)
      // When paused after being capped, pausedTime should be MAX_CLOCK_INCREMENT (1 minute)
      clockMs = pausedTime || 0;
    }

    setClock(formatMilliseconds(clockMs));
  }, [pausedTime, startTime, stopTime, replayMode, propsIsPaused]);

  useEffect(() => {
    // Use setTimeout to avoid calling setState synchronously in effect
    const timeoutId = setTimeout(() => {
      updateClock();
    }, 0);
    const interval = setInterval(updateClock, 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [updateClock]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      if (onStart) {
        onStart();
      }
    } else {
      if (onPause) {
        onPause();
      }
    }
  }, [isPaused, onStart, onPause]);

  const clockStr = isPaused ? `(${clock})` : clock;
  const titleStr = isPaused ? 'Click to unpause' : 'Click to pause';
  return (
    <div className="clock" onClick={togglePause} title={titleStr}>
      {clockStr}
    </div>
  );
};

export default Clock;
