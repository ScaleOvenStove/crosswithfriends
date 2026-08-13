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

  it('adapts to a genuine clock change once the estimate goes stale', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 30_000);
    expect(getServerTimeOffset()).toBe(30_000);

    // Past the window, a lower sample is trusted — the device clock really did
    // move, rather than one event arriving late.
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    recordServerTimestamp(Date.now() + 2_000);

    expect(getServerTimeOffset()).toBe(2_000);
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
