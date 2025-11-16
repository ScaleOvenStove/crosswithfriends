import {screen, waitFor, act} from '@testing-library/react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';

import Timestamp from '../../../components/common/Timestamp';
import {renderWithProviders} from '../../utils';

describe('Timestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render timestamp from Unix timestamp (seconds)', () => {
    const timestamp = Math.floor(new Date('2024-01-15T11:00:00Z').getTime() / 1000);

    renderWithProviders(<Timestamp time={timestamp} />);

    // The component uses toLocaleString which formats as "1/15/2024, 6:00:00 AM"
    expect(screen.getByText(/1\/15\/2024|2024/i)).toBeInTheDocument();
  });

  it('should render timestamp from string', () => {
    const timestamp = Math.floor(new Date('2024-01-15T11:00:00Z').getTime() / 1000).toString();

    renderWithProviders(<Timestamp time={timestamp} />);

    expect(screen.getByText(/1\/15\/2024|2024/i)).toBeInTheDocument();
  });

  it('should render timestamp from Date object', () => {
    const date = new Date('2024-01-15T11:00:00Z');

    renderWithProviders(<Timestamp time={date} />);

    expect(screen.getByText(/1\/15\/2024|2024/i)).toBeInTheDocument();
  });

  it('should render relative time for recent timestamps', () => {
    const oneHourAgo = Math.floor((Date.now() - 3600000) / 1000); // 1 hour ago

    renderWithProviders(<Timestamp time={oneHourAgo} relative />);

    expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
  });

  it('should render "just now" for very recent timestamps', () => {
    const justNow = Math.floor(Date.now() / 1000);

    renderWithProviders(<Timestamp time={justNow} relative />);

    expect(screen.getByText(/just now/i)).toBeInTheDocument();
  });

  it('should render relative time for minutes', () => {
    const thirtyMinutesAgo = Math.floor((Date.now() - 1800000) / 1000); // 30 minutes ago

    renderWithProviders(<Timestamp time={thirtyMinutesAgo} relative />);

    expect(screen.getByText(/30 minutes ago/i)).toBeInTheDocument();
  });

  it('should render relative time for days', () => {
    const twoDaysAgo = Math.floor((Date.now() - 172800000) / 1000); // 2 days ago

    renderWithProviders(<Timestamp time={twoDaysAgo} relative />);

    expect(screen.getByText(/2 days ago/i)).toBeInTheDocument();
  });

  it('should update relative time when autoUpdate is true', async () => {
    const oneMinuteAgo = Math.floor((Date.now() - 60000) / 1000);

    renderWithProviders(<Timestamp time={oneMinuteAgo} relative autoUpdate />);

    expect(screen.getByText(/1 minute ago/i)).toBeInTheDocument();

    // Advance system time by 1 minute so the relative time calculation changes
    const newTime = new Date(Date.now() + 60000);
    act(() => {
      vi.setSystemTime(newTime);
    });

    // Advance timers by 60 seconds to trigger the setInterval callback
    // The component updates every 60 seconds (60000ms)
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Wait for the update - the component should re-render after the interval fires
    // Don't use runAllTimers() as it causes infinite loops with setInterval
    await waitFor(
      () => {
        expect(screen.getByText(/2 minutes ago/i)).toBeInTheDocument();
      },
      {timeout: 2000}
    );
  }, 15000);

  it('should not update when autoUpdate is false', () => {
    const oneMinuteAgo = Math.floor((Date.now() - 60000) / 1000);

    renderWithProviders(<Timestamp time={oneMinuteAgo} relative autoUpdate={false} />);

    expect(screen.getByText(/1 minute ago/i)).toBeInTheDocument();

    vi.advanceTimersByTime(60000);

    // Should still show 1 minute ago
    expect(screen.getByText(/1 minute ago/i)).toBeInTheDocument();
  });

  it('should handle invalid timestamp gracefully', () => {
    renderWithProviders(<Timestamp time={0} />);

    // Timestamp 0 is epoch, which renders as "12/31/1969, 7:00:00 PM" in some locales
    expect(screen.getByText(/1969|1970/i)).toBeInTheDocument();
  });
});
