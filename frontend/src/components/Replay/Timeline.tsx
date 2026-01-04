/**
 * Timeline Component for Replay System
 * Provides seekable progress bar for game event playback
 */

import { useRef, useState, useEffect } from 'react';

interface TimelineProps {
  currentEventIndex: number;
  totalEvents: number;
  onSeek: (eventIndex: number) => void;
  disabled?: boolean;
}

const Timeline = ({ currentEventIndex, totalEvents, onSeek, disabled = false }: TimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const progress = totalEvents > 0 ? (currentEventIndex / totalEvents) * 100 : 0;

  const handleSeek = (clientX: number) => {
    if (!timelineRef.current || disabled) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const targetIndex = Math.floor(percentage * totalEvents);

    onSeek(Math.max(0, Math.min(targetIndex, totalEvents - 1)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !disabled) {
      handleSeek(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }

    return undefined;
  }, [isDragging]);

  return (
    <div className={`timeline-container ${disabled ? 'disabled' : ''}`}>
      <div className="timeline-info">
        <span className="timeline-current">Event {currentEventIndex + 1}</span>
        <span className="timeline-total">of {totalEvents}</span>
      </div>

      <div
        ref={timelineRef}
        className="timeline"
        onMouseDown={handleMouseDown}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={totalEvents}
        aria-valuenow={currentEventIndex}
        aria-label="Replay timeline"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, currentEventIndex - 1));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(totalEvents - 1, currentEventIndex + 1));
          }
        }}
      >
        <div className="timeline-track">
          <div className="timeline-progress" style={{ width: `${progress}%` }} />
          <div className="timeline-handle" style={{ left: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default Timeline;
