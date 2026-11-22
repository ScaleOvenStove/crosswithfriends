import {describe, it, expect, afterEach, vi} from 'vitest';
import {getStoredItem, setStoredItem} from '../safeStorage';

// Simulate a browser that blocks site data: touching window.localStorage throws.
function blockLocalStorage() {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    },
  });
  return () => Object.defineProperty(window, 'localStorage', original);
}

describe('safeStorage', () => {
  let restore = null;
  afterEach(() => {
    restore?.();
    restore = null;
    window.localStorage.clear();
  });

  it('round-trips a value when storage is available', () => {
    expect(setStoredItem('k', 'v')).toBe(true);
    expect(getStoredItem('k')).toBe('v');
  });

  it('returns null for a missing key', () => {
    expect(getStoredItem('missing')).toBeNull();
  });

  // JAVASCRIPT-REACT-75: the old `localStorage && ...` guard threw here.
  it('does not throw when reading window.localStorage itself throws', () => {
    restore = blockLocalStorage();
    expect(() => window.localStorage).toThrow();
    expect(getStoredItem('k')).toBeNull();
    expect(setStoredItem('k', 'v')).toBe(false);
  });
});

describe('getLocalId with storage blocked', () => {
  let restore = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('falls back to an anonymous id instead of throwing', async () => {
    restore = blockLocalStorage();
    vi.resetModules();
    const {default: getLocalId} = await import('../../localAuth');
    const id = getLocalId();
    expect(id).toMatch(/^anon/);
    expect(getLocalId()).toBe(id);
  });
});
