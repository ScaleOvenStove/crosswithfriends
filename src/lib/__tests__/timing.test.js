import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getServerTimeOffset, recordServerTimestamp, resetServerTimeOffset, serverNow} from '../timing';

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

  it('measures how far this device is ahead of the server', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local - 30_000);

    expect(getServerTimeOffset()).toBe(-30_000);
    expect(serverNow()).toBe(local - 30_000);
  });

  // Every sample is biased low by however long the event was in flight, so the
  // largest recent sample is the best estimate. Preferring the newest let one
  // late callback rewind serverNow() and stall the displayed clock.
  it('keeps the best sample rather than the newest one', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 5_000);
    // A delayed callback: same true offset, but 4s of queueing lands in the
    // local term and makes the sample look smaller.
    recordServerTimestamp(local + 1_000);

    expect(getServerTimeOffset()).toBe(5_000);
  });

  it('adopts a better sample immediately', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 1_000);
    recordServerTimestamp(local + 5_000);

    expect(getServerTimeOffset()).toBe(5_000);
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

  it('adapts to a genuine clock change once two samples agree', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 30_000);
    expect(getServerTimeOffset()).toBe(30_000);

    // Past the window, two agreeing lower samples are believed — the device
    // clock really did move, rather than one event arriving late.
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    recordServerTimestamp(Date.now() + 2_000);
    expect(getServerTimeOffset()).toBe(30_000); // one lower sample proves nothing
    recordServerTimestamp(Date.now() + 2_000);

    expect(getServerTimeOffset()).toBe(2_000);
  });

  // A long suspension makes the estimate stale AND the queued sample delayed at
  // the same time, so an expiry branch that trusted a lone sample would rewind
  // the clock exactly when it is most likely to be wrong.
  it('does not trust a lone delayed sample after a long suspension', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 30_000);
    const before = serverNow();

    // Tab suspended for ten minutes; on resume a queued event's callback runs
    // with a stamp from before the suspension.
    vi.advanceTimersByTime(10 * 60 * 1000);
    recordServerTimestamp(Date.now() + 30_000 - 10 * 60 * 1000);

    expect(getServerTimeOffset()).toBe(30_000);
    expect(serverNow()).toBe(before + 10 * 60 * 1000);
  });

  it('recovers immediately from the join ack after a suspension', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 30_000);

    vi.advanceTimersByTime(10 * 60 * 1000);
    // Stale delayed sample first, then the reconnect's fresh ack.
    recordServerTimestamp(Date.now() + 30_000 - 10 * 60 * 1000);
    recordServerTimestamp(Date.now() + 45_000);

    expect(getServerTimeOffset()).toBe(45_000);
  });

  it('disagreeing low samples never accumulate into an adoption', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 30_000);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    // Independent delays of differing magnitude — no two agree.
    recordServerTimestamp(Date.now() + 30_000 - 8_000);
    recordServerTimestamp(Date.now() + 30_000 - 20_000);
    recordServerTimestamp(Date.now() + 30_000 - 3_000);

    expect(getServerTimeOffset()).toBe(30_000);
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
});
