import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  MAX_CLOCK_INCREMENT,
  getServerTimeOffset,
  recordServerTimeExchange,
  recordServerTimestamp,
  resetServerTimeOffset,
  serverNow,
  unaccountedClockTime,
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

  describe('unaccountedClockTime', () => {
    it('is zero for a paused or never-started clock', () => {
      vi.useFakeTimers();
      expect(unaccountedClockTime(undefined)).toBe(0);
      expect(unaccountedClockTime({paused: true, lastUpdated: Date.now() - 5_000})).toBe(0);
      expect(unaccountedClockTime({paused: false, lastUpdated: 0})).toBe(0);
    });

    it('measures the gap on the server clock', () => {
      vi.useFakeTimers();
      recordServerTimestamp(Date.now() + 10_000);
      // Last event was stamped 5s ago in server time.
      expect(unaccountedClockTime({paused: false, lastUpdated: Date.now() + 10_000 - 5_000})).toBe(5_000);
    });

    // Same cap tick() applies to a gap, so a stale lastUpdated — a device clock
    // stepped forward, an offset estimate not yet corrected — can't inflate a
    // recorded solve without limit.
    it('caps the gap the way tick does', () => {
      vi.useFakeTimers();
      const local = Date.now();
      expect(unaccountedClockTime({paused: false, lastUpdated: local - 60 * 60 * 1000})).toBe(
        MAX_CLOCK_INCREMENT
      );
    });

    it('never goes negative when lastUpdated is in the future', () => {
      vi.useFakeTimers();
      expect(unaccountedClockTime({paused: false, lastUpdated: Date.now() + 30_000})).toBe(0);
    });
  });

  describe('timed exchange from the join ack', () => {
    // Helper: build the four timestamps for a device whose clock is `offset`
    // behind the server, with a given one-way network time and server think time.
    const exchange = ({offset, oneWay, processing}) => {
      const sentAt = Date.now();
      const serverReceivedAt = sentAt + offset + oneWay;
      return {
        sentAt,
        serverReceivedAt,
        serverSentAt: serverReceivedAt + processing,
        receivedAt: sentAt + 2 * oneWay + processing,
      };
    };

    it('corrects the offset downward, which broadcasts cannot', () => {
      vi.useFakeTimers();
      recordServerTimestamp(Date.now() + 30_000);
      expect(getServerTimeOffset()).toBe(30_000);

      // The device clock really did move: the exchange proves the server is
      // only 2s ahead now.
      recordServerTimeExchange(exchange({offset: 2_000, oneWay: 0, processing: 0}));

      expect(getServerTimeOffset()).toBe(2_000);
    });

    it('recovers the offset exactly despite symmetric network delay', () => {
      vi.useFakeTimers();
      recordServerTimeExchange(exchange({offset: 1_000, oneWay: 200, processing: 0}));

      expect(getServerTimeOffset()).toBe(1_000);
    });

    // The whole point of sending both server timestamps: halving the total
    // duration would charge this processing to the outbound flight.
    it('does not mistake slow server processing for flight time', () => {
      vi.useFakeTimers();
      recordServerTimeExchange(exchange({offset: 1_000, oneWay: 50, processing: 8_000}));

      expect(getServerTimeOffset()).toBe(1_000);
    });

    it('recovers immediately after a suspension', () => {
      vi.useFakeTimers();
      recordServerTimestamp(Date.now() + 30_000);

      vi.advanceTimersByTime(10 * 60 * 1000);
      // Stale delayed broadcast first, then the reconnect's timed exchange.
      recordServerTimestamp(Date.now() + 30_000 - 10 * 60 * 1000);
      recordServerTimeExchange(exchange({offset: 45_000, oneWay: 0, processing: 120}));

      expect(getServerTimeOffset()).toBe(45_000);
    });

    it('falls back to raise-only when the network trip is too long to bound', () => {
      vi.useFakeTimers();
      recordServerTimestamp(Date.now() + 30_000);

      // A 30s network trip says nothing useful about where in that window the
      // stamp was taken, so it must not be trusted downward.
      recordServerTimeExchange(exchange({offset: 2_000, oneWay: 15_000, processing: 10}));
      expect(getServerTimeOffset()).toBe(30_000);
    });

    it('degrades to a one-way sample when the server sends no receive time', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      // Older server: can't split the round trip, so this may only raise.
      recordServerTimeExchange({sentAt: local, serverSentAt: local + 2_000, receivedAt: local + 40});
      expect(getServerTimeOffset()).toBe(30_000);

      recordServerTimeExchange({sentAt: local, serverSentAt: local + 60_000, receivedAt: local + 40});
      expect(getServerTimeOffset()).toBe(60_000);
    });

    it('ignores an incoherent exchange', () => {
      vi.useFakeTimers();
      const local = Date.now();
      recordServerTimestamp(local + 30_000);

      // Server timestamps inverted, and a receive that precedes the send.
      recordServerTimeExchange({
        sentAt: local,
        serverReceivedAt: local + 500,
        serverSentAt: local + 100,
        receivedAt: local + 600,
      });
      expect(getServerTimeOffset()).toBe(30_000);

      recordServerTimeExchange({sentAt: local, serverSentAt: undefined, receivedAt: local + 40});
      expect(getServerTimeOffset()).toBe(30_000);
    });
  });
});
