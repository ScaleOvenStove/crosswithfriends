import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getServerTimeOffset,
  recordServerTimeFromRoundTrip,
  recordServerTimestamp,
  resetServerTimeOffset,
  serverNow,
} from '../timing';

describe('server time offset', () => {
  beforeEach(() => {
    resetServerTimeOffset();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetServerTimeOffset();
  });

  it('defaults to no offset', () => {
    expect(getServerTimeOffset()).toBe(0);
    expect(serverNow()).toBeCloseTo(Date.now(), -2);
  });

  it('measures how far this device is behind the server', () => {
    vi.useFakeTimers();
    const local = Date.now();
    // Server-stamped event lands while our clock reads 30s earlier.
    recordServerTimestamp(local + 30_000);

    expect(getServerTimeOffset()).toBe(30_000);
    expect(serverNow()).toBe(local + 30_000);
  });

  it('ignores samples that are not finite numbers', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 7_000);
    // A non-sample must not be treated as "no offset yet" and reset anything.
    recordServerTimestamp(undefined);
    recordServerTimestamp(null);
    recordServerTimestamp('1700000000000');
    recordServerTimestamp(NaN);
    recordServerTimestamp(Infinity);

    expect(getServerTimeOffset()).toBe(7_000);
  });

  describe('one-way samples from broadcast events', () => {
    // A sample is `serverStamp - Date.now()`, so in-flight delay lands in the
    // local term and biases it low. A higher sample can't be explained by delay.
    it('adopts a better sample immediately', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 1_000);
      recordServerTimestamp(local + 5_000);

      expect(getServerTimeOffset()).toBe(5_000);
    });

    it('never lowers the estimate, however many low samples arrive', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      recordServerTimestamp(local + 30_000 - 4_000);
      recordServerTimestamp(local + 30_000 - 4_000);
      recordServerTimestamp(local + 30_000 - 4_000);
      recordServerTimestamp(local + 30_000 - 90_000);

      expect(getServerTimeOffset()).toBe(30_000);
    });

    it('does not let a late event rewind server time', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);
      const before = serverNow();

      // Tab suspended: this event's callback runs two minutes after it was
      // stamped, which would read as the device being 2min ahead of the server.
      recordServerTimestamp(local + 30_000 - 120_000);

      expect(serverNow()).toBe(before);
    });

    // A suspended tab resumes by draining a batch of queued events whose delays
    // are near-identical, so agreement between them proves nothing about
    // freshness — an earlier version of this module was fooled by exactly this.
    it('is not fooled by a batch of queued events agreeing with each other', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      vi.advanceTimersByTime(10 * 60 * 1000);
      // Two events stamped 200ms apart, both delivered on resume.
      const suspension = 10 * 60 * 1000;
      recordServerTimestamp(Date.now() + 30_000 - suspension);
      recordServerTimestamp(Date.now() + 30_000 - suspension + 200);

      expect(getServerTimeOffset()).toBe(30_000);
    });
  });

  describe('round-trip samples from the join ack', () => {
    it('corrects the offset downward, which broadcasts cannot', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);
      expect(getServerTimeOffset()).toBe(30_000);

      // The device clock really did move: a timed round trip proves the server
      // is only 2s ahead now.
      recordServerTimeFromRoundTrip(Date.now() + 2_000, 0);

      expect(getServerTimeOffset()).toBe(2_000);
    });

    // The stamp was taken somewhere between our send and our receive, so
    // assuming the midpoint leaves ±rtt/2 of error rather than a systematic lag.
    it('credits half the round trip to the flight out', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimeFromRoundTrip(local + 1_000, 400);

      expect(getServerTimeOffset()).toBe(1_200);
    });

    it('recovers immediately after a suspension', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      vi.advanceTimersByTime(10 * 60 * 1000);
      // Stale delayed broadcast first, then the reconnect's timed ack.
      recordServerTimestamp(Date.now() + 30_000 - 10 * 60 * 1000);
      recordServerTimeFromRoundTrip(Date.now() + 45_000, 100);

      expect(getServerTimeOffset()).toBe(45_050);
    });

    it('falls back to raise-only when the round trip is too long to bound the delay', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      // 30s round trip says nothing useful about where in that window the
      // stamp was taken, so it must not be trusted downward.
      recordServerTimeFromRoundTrip(Date.now() + 2_000, 30_000);
      expect(getServerTimeOffset()).toBe(30_000);

      // Still usable in the direction delay can't fake.
      recordServerTimeFromRoundTrip(Date.now() + 60_000, 30_000);
      expect(getServerTimeOffset()).toBe(60_000);
    });

    it('ignores a malformed round trip measurement', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      recordServerTimeFromRoundTrip(Date.now() + 2_000, -5);
      recordServerTimeFromRoundTrip(Date.now() + 2_000, NaN);
      recordServerTimeFromRoundTrip(Date.now() + 2_000, undefined);

      expect(getServerTimeOffset()).toBe(30_000);
    });
  });
});
