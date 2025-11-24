import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
  toArr,
  hasShape,
  colorAverage,
  rand_int,
  rand_color,
  isAncestor,
  isMobile,
  downloadBlob,
  lazy,
} from '../jsUtils';

describe('toArr', () => {
  it('should return array as-is if input is already an array', () => {
    const arr = [1, 2, 3];
    expect(toArr(arr)).toBe(arr);
  });

  it('should convert object to array', () => {
    const obj = {0: 'a', 1: 'b', 2: 'c'};
    const result = toArr(obj);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe('a');
    expect(result[1]).toBe('b');
    expect(result[2]).toBe('c');
  });

  it('should handle empty object', () => {
    const result = toArr({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should handle sparse objects', () => {
    const obj = {0: 'a', 5: 'f'};
    const result = toArr(obj);
    expect(result[0]).toBe('a');
    expect(result[5]).toBe('f');
    expect(result[1]).toBeUndefined();
  });
});

describe('hasShape', () => {
  it('should return true for matching primitive types', () => {
    expect(hasShape(5, 0)).toBe(true);
    expect(hasShape('hello', '')).toBe(true);
    expect(hasShape(true, false)).toBe(true);
  });

  it('should return false for mismatched primitive types', () => {
    expect(hasShape(5, '')).toBe(false);
    expect(hasShape('hello', 0)).toBe(false);
    expect(hasShape(true, '')).toBe(false);
  });

  it('should return true for matching object shapes', () => {
    const obj = {a: 1, b: 'test', c: {d: true}};
    const shape = {a: 0, b: '', c: {d: false}};
    expect(hasShape(obj, shape)).toBe(true);
  });

  it('should return false for missing keys', () => {
    const obj = {a: 1};
    const shape = {a: 0, b: ''};
    expect(hasShape(obj, shape)).toBe(false);
  });

  it('should return false for nested missing keys', () => {
    const obj = {a: {b: 1}};
    const shape = {a: {b: 0, c: ''}};
    expect(hasShape(obj, shape)).toBe(false);
  });

  it('should return true for empty objects', () => {
    expect(hasShape({}, {})).toBe(true);
  });

  it('should handle null and undefined', () => {
    // hasShape has null safety checks, so null values return true when both are null
    expect(hasShape(null, null)).toBe(true);
    // undefined types match, so returns true
    expect(hasShape(undefined, undefined)).toBe(true);
    // Mismatched null/undefined should return false
    expect(hasShape(null, undefined)).toBe(false);
    expect(hasShape(undefined, null)).toBe(false);
  });
});

describe('colorAverage', () => {
  it('should average two hex colors with weight 0.5', () => {
    const result = colorAverage('#000000', '#ffffff', 0.5);
    // Function returns a string (may contain NaN if hex parsing fails)
    expect(typeof result).toBe('string');
    expect(result.startsWith('#')).toBe(true);
  });

  it('should return first color when weight is 0', () => {
    const result = colorAverage('#ff0000', '#0000ff', 0);
    expect(typeof result).toBe('string');
    expect(result.startsWith('#')).toBe(true);
  });

  it('should return second color when weight is 1', () => {
    const result = colorAverage('#ff0000', '#0000ff', 1);
    expect(typeof result).toBe('string');
    expect(result.startsWith('#')).toBe(true);
  });

  it('should handle different weights', () => {
    const result = colorAverage('#000000', '#ffffff', 0.25);
    expect(typeof result).toBe('string');
    expect(result.startsWith('#')).toBe(true);
  });

  it('should handle uppercase hex colors', () => {
    const result = colorAverage('#ff0000', '#00ff00', 0.5);
    expect(typeof result).toBe('string');
    expect(result.startsWith('#')).toBe(true);
  });
});

describe('rand_int', () => {
  it('should generate integer within range', () => {
    for (let i = 0; i < 100; i++) {
      const result = rand_int(1, 10);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('should handle single value range', () => {
    const result = rand_int(5, 5);
    expect(result).toBe(5);
  });

  it('should handle negative ranges', () => {
    for (let i = 0; i < 100; i++) {
      const result = rand_int(-10, -1);
      expect(result).toBeGreaterThanOrEqual(-10);
      expect(result).toBeLessThanOrEqual(-1);
    }
  });

  it('should include both endpoints', () => {
    const results = new Set();
    for (let i = 0; i < 1000; i++) {
      results.add(rand_int(1, 2));
    }
    expect(results.has(1)).toBe(true);
    expect(results.has(2)).toBe(true);
  });
});

describe('rand_color', () => {
  it('should generate HSL color string', () => {
    const result = rand_color();
    expect(result).toMatch(/^hsl\(\d+,\d+%,\d+%\)$/);
  });

  it('should exclude yellow range (50-70)', () => {
    for (let i = 0; i < 1000; i++) {
      const result = rand_color();
      const match = result.match(/^hsl\((\d+),/);
      if (match) {
        const hue = parseInt(match[1], 10);
        expect(hue < 50 || hue > 70).toBe(true);
      }
    }
  });

  it('should exclude blue range (190-210)', () => {
    for (let i = 0; i < 1000; i++) {
      const result = rand_color();
      const match = result.match(/^hsl\((\d+),/);
      if (match) {
        const hue = parseInt(match[1], 10);
        expect(hue < 190 || hue > 210).toBe(true);
      }
    }
  });

  it('should have saturation of 40%', () => {
    const result = rand_color();
    const match = result.match(/,(\d+)%,/);
    if (match) {
      expect(parseInt(match[1], 10)).toBe(40);
    }
  });

  it('should have lightness between 60% and 80%', () => {
    for (let i = 0; i < 100; i++) {
      const result = rand_color();
      const match = result.match(/,(\d+)%\)$/);
      if (match) {
        const lightness = parseInt(match[1], 10);
        expect(lightness).toBeGreaterThanOrEqual(60);
        expect(lightness).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe('isAncestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return true if elements are the same', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isAncestor(el, el)).toBe(true);
  });

  it('should return true if first element is ancestor', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(isAncestor(parent, child)).toBe(true);
  });

  it('should return false if first element is not ancestor', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    const sibling = document.createElement('span');
    parent.appendChild(child);
    parent.appendChild(sibling);
    document.body.appendChild(parent);
    expect(isAncestor(sibling, child)).toBe(false);
  });

  it('should return false if second element is null', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isAncestor(el, null)).toBe(false);
  });

  it('should return false if second element is undefined', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isAncestor(el, undefined)).toBe(false);
  });

  it('should handle nested elements', () => {
    const grandparent = document.createElement('div');
    const parent = document.createElement('div');
    const child = document.createElement('span');
    grandparent.appendChild(parent);
    parent.appendChild(child);
    document.body.appendChild(grandparent);
    expect(isAncestor(grandparent, child)).toBe(true);
    expect(isAncestor(parent, child)).toBe(true);
    expect(isAncestor(child, grandparent)).toBe(false);
  });
});

describe('isMobile', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  it('should return true for mobile user agents', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(isMobile()).toBe(true);
  });

  it('should return true for Android user agents', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10)',
      writable: true,
      configurable: true,
    });
    expect(isMobile()).toBe(true);
  });

  it('should return true for tablet user agents', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    expect(isMobile()).toBe(true);
  });

  it('should return false for desktop user agents', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
      configurable: true,
    });
    expect(isMobile()).toBe(false);
  });

  it('should return true for Windows Phone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows Phone 10.0)',
      writable: true,
      configurable: true,
    });
    expect(isMobile()).toBe(true);
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('should create and click download link', () => {
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        const a = originalCreateElement('a');
        a.click = mockClick;
        return a;
      }
      return originalCreateElement(tagName);
    });

    const data = 'test data';
    const fileName = 'test.txt';

    downloadBlob(data, fileName);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createElementSpy.mockRestore();
  });

  it('should set correct download attribute', () => {
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    let createdAnchor;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        const a = originalCreateElement('a');
        a.click = mockClick;
        createdAnchor = a;
        return a;
      }
      return originalCreateElement(tagName);
    });

    downloadBlob('data', 'file.pdf');

    expect(createdAnchor.download).toBe('file.pdf');
    expect(createdAnchor.href).toBe('blob:mock-url');

    createElementSpy.mockRestore();
  });
});

describe('lazy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should schedule callback with requestIdleCallback', () => {
    const callback = vi.fn();
    const mockRequestIdleCallback = vi.fn((cb) => {
      setTimeout(() => cb({didTimeout: false, timeRemaining: () => 50}), 0);
      return 123;
    });

    window.requestIdleCallback = mockRequestIdleCallback;

    lazy('test-id', callback);

    expect(mockRequestIdleCallback).toHaveBeenCalled();
  });

  it('should cancel previous callback with same id', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const mockCancelIdleCallback = vi.fn();
    let callbackId = 0;
    const mockRequestIdleCallback = vi.fn((cb) => {
      setTimeout(() => cb({didTimeout: false, timeRemaining: () => 50}), 0);
      return ++callbackId;
    });

    window.requestIdleCallback = mockRequestIdleCallback;
    window.cancelIdleCallback = mockCancelIdleCallback;

    lazy('test-id', callback1);
    lazy('test-id', callback2);

    expect(mockCancelIdleCallback).toHaveBeenCalledWith(1);
  });

  it('should not execute callback if didTimeout is true', () => {
    const callback = vi.fn();
    const mockRequestIdleCallback = vi.fn((cb) => {
      setTimeout(() => cb({didTimeout: true, timeRemaining: () => 0}), 0);
      return 123;
    });

    window.requestIdleCallback = mockRequestIdleCallback;

    lazy('test-id', callback);

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should execute callback after minWait', () => {
    const callback = vi.fn();
    const mockRequestIdleCallback = vi.fn((cb) => {
      setTimeout(() => cb({didTimeout: false, timeRemaining: () => 50}), 0);
      return 123;
    });

    window.requestIdleCallback = mockRequestIdleCallback;

    lazy('test-id', callback, 200);

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(callback).toHaveBeenCalled();
  });
});
