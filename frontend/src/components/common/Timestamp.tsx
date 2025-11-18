import React from 'react';

interface TimestampProps {
  time: number | string | Date;
  format?: string;
  relative?: boolean;
  autoUpdate?: boolean;
}

/**
 * A simple timestamp component that replaces react-timestamp.
 * Formats Unix timestamps (in seconds) or Date objects.
 */
const Timestamp: React.FC<TimestampProps> = ({time, format, relative, autoUpdate}) => {
  const formatTime = React.useCallback(
    (timestamp: number): string => {
      const date = new Date(timestamp * 1000); // Convert seconds to milliseconds

      if (relative) {
        const now = Date.now();
        const diff = now - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        return 'just now';
      }

      if (format) {
        // Simple format support - can be extended if needed
        return date.toLocaleString();
      }

      // Default format: show date and time
      return date.toLocaleString();
    },
    [relative, format]
  );

  const getTimestamp = (): number => {
    if (typeof time === 'number') {
      return time;
    }
    if (typeof time === 'string') {
      return parseInt(time, 10);
    }
    if (time instanceof Date) {
      return Math.floor(time.getTime() / 1000);
    }
    return 0;
  };

  const timestamp = getTimestamp();
  const [displayTime, setDisplayTime] = React.useState(() => formatTime(timestamp));

  // Update display time when timestamp changes
  React.useEffect(() => {
    setDisplayTime(formatTime(timestamp));
  }, [timestamp, formatTime]);

  // Set up auto-update interval
  React.useEffect(() => {
    if (autoUpdate && relative) {
      const interval = setInterval(() => {
        setDisplayTime(formatTime(timestamp));
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [timestamp, relative, autoUpdate, formatTime]);

  return <span>{displayTime}</span>;
};

export default Timestamp;
