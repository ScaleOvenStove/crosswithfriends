import {describe, it, expect} from 'vitest';

import {formatMilliseconds} from '../../components/Toolbar/Clock';

describe('formatMilliseconds', () => {
  it('should format milliseconds less than a minute', () => {
    expect(formatMilliseconds(0)).toBe('00:00');
    expect(formatMilliseconds(1000)).toBe('00:01');
    expect(formatMilliseconds(5000)).toBe('00:05');
    expect(formatMilliseconds(30000)).toBe('00:30');
    expect(formatMilliseconds(59000)).toBe('00:59');
  });

  it('should format milliseconds for minutes', () => {
    expect(formatMilliseconds(60000)).toBe('01:00');
    expect(formatMilliseconds(90000)).toBe('01:30');
    expect(formatMilliseconds(120000)).toBe('02:00');
    expect(formatMilliseconds(300000)).toBe('05:00');
    expect(formatMilliseconds(3540000)).toBe('59:00');
  });

  it('should format milliseconds for hours', () => {
    expect(formatMilliseconds(3600000)).toBe('1:00:00');
    expect(formatMilliseconds(3660000)).toBe('1:01:00');
    expect(formatMilliseconds(3661000)).toBe('1:01:01');
    expect(formatMilliseconds(7200000)).toBe('2:00:00');
    expect(formatMilliseconds(7323000)).toBe('2:02:03');
  });

  it('should handle large time values', () => {
    expect(formatMilliseconds(86400000)).toBe('24:00:00'); // 24 hours
    expect(formatMilliseconds(90000000)).toBe('25:00:00'); // 25 hours
  });

  it('should pad seconds and minutes correctly', () => {
    expect(formatMilliseconds(1000)).toBe('00:01');
    expect(formatMilliseconds(61000)).toBe('01:01');
    expect(formatMilliseconds(3661000)).toBe('1:01:01');
  });

  it('should handle fractional seconds correctly', () => {
    expect(formatMilliseconds(500)).toBe('00:00');
    expect(formatMilliseconds(1500)).toBe('00:01');
    expect(formatMilliseconds(999)).toBe('00:00');
  });
});
