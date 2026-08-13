import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Clock, {formatMilliseconds} from '../Clock';
import {recordServerTimestamp, resetServerTimeOffset} from '../../../lib/timing';

// Clock's displayed value is pure arithmetic over props, so drive updateClock()
// directly instead of pulling in a DOM renderer.
function displayedClock(props) {
  const clock = new Clock();
  clock.props = props;
  let state = null;
  clock.setState = (next) => {
    state = next;
  };
  clock.updateClock();
  return state.clock;
}

describe('formatMilliseconds', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatMilliseconds(0)).toBe('00:00');
    expect(formatMilliseconds(30_000)).toBe('00:30');
    expect(formatMilliseconds(90_000)).toBe('01:30');
  });

  it('formats over an hour as h:mm:ss', () => {
    expect(formatMilliseconds(3_690_000)).toBe('1:01:30');
  });
});

describe('Clock display', () => {
  beforeEach(() => {
    resetServerTimeOffset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetServerTimeOffset();
  });

  it('shows only the banked time while paused', () => {
    const now = Date.now();
    expect(displayedClock({startTime: now - 60_000, pausedTime: 12_000, isPaused: true})).toBe('00:12');
  });

  it('adds the time elapsed since the last event while running', () => {
    const now = Date.now();
    expect(displayedClock({startTime: now - 5_000, pausedTime: 12_000, isPaused: false})).toBe('00:17');
  });

  it('shows the frozen solve time once stopped', () => {
    const now = Date.now();
    expect(
      displayedClock({startTime: now - 60_000, stopTime: now - 30_000, pausedTime: 0, isPaused: false})
    ).toBe('00:30');
  });

  // startTime is clock.lastUpdated, a server-stamped event timestamp. Measuring
  // the live portion with a raw local Date.now() showed the device's own clock
  // skew as solve time — the reported "timer jumps to ~30s on the first letter".
  it('does not count a fast local clock as solve time', () => {
    const local = Date.now();
    // A live event tells us the server is 30s behind this device's clock.
    recordServerTimestamp(local - 30_000);
    // That same event is what set lastUpdated, so no time has really elapsed.
    expect(displayedClock({startTime: local - 30_000, pausedTime: 0, isPaused: false})).toBe('00:00');
  });

  it('does not stall the timer when the local clock is slow', () => {
    const local = Date.now();
    // Server is 30s ahead of this device.
    recordServerTimestamp(local + 30_000);
    // Event stamped 5s (server time) ago.
    expect(displayedClock({startTime: local + 25_000, pausedTime: 0, isPaused: false})).toBe('00:05');
  });
});
