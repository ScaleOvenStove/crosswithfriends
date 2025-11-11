import React, {useMemo, useRef, useState, useEffect, useCallback} from 'react';
import _ from 'lodash';
import {pure, isAncestor} from '@crosswithfriends/shared/lib/jsUtils';
import './timeline.css';

const TIMELINE_COLORS = {
  updateCell: '#9999FFC0',
  updateCursor: '#00000030',
  reveal: '#EE0000C0',
  check: '#EE000050',
  updateClock: '#0000EE80',
  chat: '#00EEEE80',
  create: '#00000080',
};

const TIMELINE_BACKGROUND_COLOR = '#00000032';

const TimelineBar = ({type}: {type: string}) => {
  const color = TIMELINE_COLORS[type as keyof typeof TIMELINE_COLORS];
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: color,
      }}
    />
  );
};

// a pure arrow function component, so bars aren't re-computed every time
const TimelineBars = pure(({history, begin, units}: {history: any[]; begin: number; units: number}) => (
  <div>
    {history.map(({gameTimestamp, type}, i) => (
      <div
        key={i}
        className="timeline--bar"
        style={{
          left: (gameTimestamp - begin) * units,
        }}
      >
        <TimelineBar type={type} />
      </div>
    ))}
  </div>
));

interface TimelineProps {
  history: Array<{gameTimestamp: number; type: string}>;
  position: number;
  width: number;
  onSetPosition: (position: number) => void;
  scrollContainer?: HTMLElement;
}

const Timeline: React.FC<TimelineProps> = ({history, position, width, onSetPosition, scrollContainer}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [down, setDown] = useState(false);

  const begin = useMemo(() => {
    return history[0]?.gameTimestamp || 0;
  }, [history]);

  const end = useMemo(() => {
    return history[history.length - 1]?.gameTimestamp || 0;
  }, [history]);

  const units = useMemo(() => {
    const length = end - begin;
    return length > 0 ? width / length : 0;
  }, [end, begin, width]);

  const updateScroll = useCallback(
    _.throttle(() => {
      if (!scrollContainer || !cursorRef.current || !timelineRef.current) {
        return;
      }
      const center = cursorRef.current.offsetLeft;

      // scroll minimally so that the center is visible with 5px padding
      const padding = 5;
      const lo = Math.min(
        timelineRef.current.clientWidth - scrollContainer.clientWidth,
        center - scrollContainer.clientWidth + padding
      );
      const hi = Math.max(0, center - padding);

      let scrollLeft = scrollContainer.scrollLeft;
      scrollLeft = Math.max(lo, Math.min(hi, scrollLeft));
      scrollContainer.scrollLeft = scrollLeft;
    }, 50),
    [scrollContainer]
  );

  const handleMouseUp = useCallback(() => {
    setDown(false);
  }, []);

  useEffect(() => {
    updateScroll();
  }, [position, updateScroll]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  const handleMouse = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const nativeEvent = e.nativeEvent;
      let x = nativeEvent.offsetX;
      let node = nativeEvent.target as HTMLElement;
      while (node !== timelineRef.current) {
        x += node.offsetLeft;
        node = node.parentElement as HTMLElement;
      }

      let newPosition = x / units + begin;
      newPosition = Math.min(end, Math.max(begin, newPosition));
      onSetPosition(newPosition);
      e.preventDefault();
      e.stopPropagation();
    },
    [units, begin, end, onSetPosition]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button) return;
      setDown(true);
      handleMouse(e);
    },
    [handleMouse]
  );

  const handleMouseOut = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    if (!isAncestor(timelineRef.current, e.nativeEvent.relatedTarget as Node)) {
      // down state remains
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!down) {
        return;
      }
      handleMouse(e);
    },
    [down, handleMouse]
  );

  return (
    <div
      ref={timelineRef}
      className="timeline"
      style={{
        position: 'relative',
        width: (end - begin) * units,
        backgroundColor: TIMELINE_BACKGROUND_COLOR,
        cursor: 'pointer',
      }}
      onMouseDown={handleMouseDown}
      onMouseOut={handleMouseOut}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <TimelineBars history={history} begin={begin} units={units} />
      <div
        ref={cursorRef}
        className="timeline--cursor"
        style={{
          position: 'absolute',
          left: (position - begin) * units - 5,
        }}
      />
      {down && timelineRef.current && (
        <div
          className="mouse--target"
          style={{
            position: 'absolute',
            left: -timelineRef.current.getBoundingClientRect().left,
            top: -timelineRef.current.getBoundingClientRect().top,
          }}
        ></div>
      )}
    </div>
  );
};

export {Timeline};
