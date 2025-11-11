import './css/clock.css';
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {getTime} from '../../store/firebase';
import {MAX_CLOCK_INCREMENT} from '@crosswithfriends/shared/lib/timing';

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

  const isCapped = useMemo(() => {
    if (!v2) return false;
    if (!startTime) return false;
    const now = getTime();
    return now > startTime + MAX_CLOCK_INCREMENT;
  }, [v2, startTime]);

  const isPaused = useMemo(() => {
    if (replayMode) return false;
    // to this component, there's no difference between capped & paused
    return propsIsPaused || isCapped;
  }, [replayMode, propsIsPaused, isCapped]);

  const updateClock = useCallback(() => {
    const now = getTime();

    let clockMs = 0; // start with pausedTime
    if (pausedTime) {
      clockMs += pausedTime;
    }

    if (startTime && !replayMode && !propsIsPaused) {
      // not paused
      if (stopTime) {
        // finished
        clockMs += stopTime - startTime;
      } else if (isCapped) {
        clockMs += MAX_CLOCK_INCREMENT;
      } else {
        clockMs += now - startTime;
      }
    }

    setClock(formatMilliseconds(clockMs));
  }, [pausedTime, startTime, stopTime, replayMode, propsIsPaused, isCapped]);

  useEffect(() => {
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => {
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
