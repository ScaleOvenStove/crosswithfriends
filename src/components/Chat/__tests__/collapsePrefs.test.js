import {describe, expect, it} from 'vitest';
import {COLLAPSE_PREFS_KEY, isPaneCollapsed, readCollapsePrefs, setPaneCollapsed} from '../collapsePrefs';

const memoryStorage = (initial = {}) => {
  const data = {...initial};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
};

describe('collapsePrefs', () => {
  it('defaults to collapsed on mobile and expanded on desktop', () => {
    expect(isPaneCollapsed({}, 'info', true)).toBe(true);
    expect(isPaneCollapsed({}, 'players', true)).toBe(true);
    expect(isPaneCollapsed({}, 'info', false)).toBe(false);
    expect(isPaneCollapsed({}, 'players', false)).toBe(false);
  });

  it('keeps choices separate per layout and persists them', () => {
    const storage = memoryStorage();
    let prefs = setPaneCollapsed({}, 'info', true, false, storage);
    prefs = setPaneCollapsed(prefs, 'players', false, true, storage);

    expect(isPaneCollapsed(prefs, 'info', true)).toBe(false);
    expect(isPaneCollapsed(prefs, 'players', true)).toBe(true); // mobile default untouched
    expect(isPaneCollapsed(prefs, 'info', false)).toBe(false); // desktop default untouched
    expect(isPaneCollapsed(prefs, 'players', false)).toBe(true);

    expect(readCollapsePrefs(storage)).toEqual(prefs);
  });

  it('ignores missing or corrupt stored values', () => {
    expect(readCollapsePrefs(memoryStorage())).toEqual({});
    expect(readCollapsePrefs(memoryStorage({[COLLAPSE_PREFS_KEY]: '{nope'}))).toEqual({});
    expect(readCollapsePrefs(memoryStorage({[COLLAPSE_PREFS_KEY]: '[1]'}))).toEqual({});
    expect(readCollapsePrefs(null)).toEqual({});
  });

  it('still updates state when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readCollapsePrefs(storage)).toEqual({});
    const prefs = setPaneCollapsed({}, 'info', true, false, storage);
    expect(isPaneCollapsed(prefs, 'info', true)).toBe(false);
  });
});
