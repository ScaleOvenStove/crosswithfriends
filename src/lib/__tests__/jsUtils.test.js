import {toArr, hasShape, rand_int} from '../jsUtils';

describe('toArr', () => {
  it('passes through an array unchanged', () => {
    const input = [1, 2, 3];
    expect(toArr(input)).toBe(input);
  });

  it('converts an object with numeric keys to an array', () => {
    const input = {0: 'a', 1: 'b', 2: 'c'};
    const result = toArr(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe('a');
    expect(result[1]).toBe('b');
    expect(result[2]).toBe('c');
  });

  it('handles sparse object keys', () => {
    const input = {0: 'a', 2: 'c'};
    const result = toArr(input);
    expect(result[0]).toBe('a');
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe('c');
  });
});

describe('hasShape', () => {
  it('returns true when object matches shape', () => {
    const obj = {name: 'test', count: 5};
    const shape = {name: '', count: 0};
    expect(hasShape(obj, shape)).toBe(true);
  });

  it('returns false when object is missing a key', () => {
    const obj = {name: 'test'};
    const shape = {name: '', count: 0};
    expect(hasShape(obj, shape)).toBe(false);
  });

  it('returns false when types differ', () => {
    expect(hasShape('string', 42)).toBe(false);
  });

  it('handles nested objects', () => {
    const obj = {user: {name: 'test', age: 25}};
    const shape = {user: {name: '', age: 0}};
    expect(hasShape(obj, shape)).toBe(true);
  });

  it('returns false for nested shape mismatch', () => {
    const obj = {user: {name: 'test'}};
    const shape = {user: {name: '', age: 0}};
    expect(hasShape(obj, shape)).toBe(false);
  });

  it('returns true for matching primitives', () => {
    expect(hasShape(42, 0)).toBe(true);
    expect(hasShape('hello', '')).toBe(true);
  });
});

// NOTE: colorAverage is not tested because hexToRgb has a bug:
// it uses Number(x, 16) instead of parseInt(x, 16), so hex parsing
// always returns NaN. This should be fixed separately.

describe('rand_int', () => {
  it('returns a value within the specified range', () => {
    for (let i = 0; i < 100; i++) {
      const result = rand_int(5, 10);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  it('returns the value when min equals max', () => {
    expect(rand_int(7, 7)).toBe(7);
  });

  it('returns an integer', () => {
    const result = rand_int(1, 100);
    expect(Number.isInteger(result)).toBe(true);
  });
});
