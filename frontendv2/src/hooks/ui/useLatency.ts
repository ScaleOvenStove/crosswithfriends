/**
 * useLatency - Hook for monitoring WebSocket connection latency
 * Uses latency_ping/latency_pong events to measure round-trip time
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@sockets/index';

interface LatencyStats {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number[];
}

interface UseLatencyOptions {
  interval?: number; // Ping interval in milliseconds
  sampleSize?: number; // Number of samples to keep for averaging
  enabled?: boolean;
}

export const useLatency = ({
  interval = 5000,
  sampleSize = 10,
  enabled = true,
}: UseLatencyOptions = {}) => {
  const { socket, isConnected } = useSocket();
  const [latency, setLatency] = useState<number | null>(null);
  const [stats, setStats] = useState<LatencyStats>({
    current: 0,
    average: 0,
    min: Infinity,
    max: 0,
    samples: [],
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const lastPingTimeRef = useRef<number>(0);

  // Calculate stats from samples
  const calculateStats = useCallback((samples: number[]): LatencyStats => {
    if (samples.length === 0) {
      return {
        current: 0,
        average: 0,
        min: Infinity,
        max: 0,
        samples: [],
      };
    }

    const current = samples[samples.length - 1];
    const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    return {
      current,
      average: Math.round(average),
      min,
      max,
      samples,
    };
  }, []);

  // Send ping
  const sendPing = useCallback(() => {
    if (!socket || !isConnected) return;

    const timestamp = Date.now();
    lastPingTimeRef.current = timestamp;
    socket.emit('latency_ping', timestamp);
  }, [socket, isConnected]);

  // Listen for pong responses
  useEffect(() => {
    if (!socket || !isConnected || !enabled) return;

    const handlePong = (serverLatency: number) => {
      const now = Date.now();
      const roundTripTime = now - lastPingTimeRef.current;

      setLatency(roundTripTime);

      setStats((prev) => {
        const newSamples = [...prev.samples, roundTripTime];
        // Keep only the last N samples
        if (newSamples.length > sampleSize) {
          newSamples.shift();
        }
        return calculateStats(newSamples);
      });
    };

    socket.on('latency_pong', handlePong);

    return () => {
      socket.off('latency_pong', handlePong);
    };
  }, [socket, isConnected, enabled, sampleSize, calculateStats]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring || !socket || !isConnected) return;

    setIsMonitoring(true);

    // Send initial ping immediately
    sendPing();

    // Set up interval for periodic pings
    intervalRef.current = window.setInterval(() => {
      sendPing();
    }, interval);
  }, [isMonitoring, socket, isConnected, sendPing, interval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    setIsMonitoring(false);

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // Auto-start monitoring when enabled and connected
  useEffect(() => {
    if (enabled && isConnected) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [enabled, isConnected, startMonitoring, stopMonitoring]);

  // Get connection quality based on latency
  const getConnectionQuality = useCallback(():
    | 'excellent'
    | 'good'
    | 'fair'
    | 'poor'
    | 'unknown' => {
    if (latency === null) return 'unknown';
    if (latency < 50) return 'excellent';
    if (latency < 100) return 'good';
    if (latency < 200) return 'fair';
    return 'poor';
  }, [latency]);

  return {
    latency,
    stats,
    isMonitoring,
    connectionQuality: getConnectionQuality(),
    startMonitoring,
    stopMonitoring,
    sendPing,
  };
};

export default useLatency;
