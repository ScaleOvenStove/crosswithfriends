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

  it('tracks the most recent sample', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 5_000);
    recordServerTimestamp(local + 1_000);

    expect(getServerTimeOffset()).toBe(1_000);
  });

  it('ignores samples that are not finite numbers', () => {
    vi.useFakeTimers();
    const local = Date.now();
    recordServerTimestamp(local + 7_000);

    recordServerTimestamp(undefined);
    recordServerTimestamp(null);
    recordServerTimestamp('1700000000000');
    recordServerTimestamp(NaN);
    recordServerTimestamp(Infinity);

    expect(getServerTimeOffset()).toBe(7_000);
  });
});
