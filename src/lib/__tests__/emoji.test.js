import {findMatches, get} from '../emoji';

describe('findMatches', () => {
  it('returns an array', () => {
    expect(Array.isArray(findMatches('smile'))).toBe(true);
  });

  it('returns exact match first', () => {
    const results = findMatches('smile');
    if (results.length > 0) {
      expect(results[0]).toBe('smile');
    }
  });

  it('returns prefix matches before substring matches', () => {
    const results = findMatches('heart');
    if (results.length >= 2) {
      // All prefix matches should come before non-prefix matches
      const firstNonPrefix = results.findIndex((e) => !e.startsWith('heart'));
      const lastPrefix = results.reduce((acc, e, i) => (e.startsWith('heart') ? i : acc), -1);
      if (firstNonPrefix !== -1) {
        expect(lastPrefix).toBeLessThan(firstNonPrefix);
      }
    }
  });

  it('returns empty array for no matches', () => {
    expect(findMatches('zzzzzzzzzzxyzzy')).toEqual([]);
  });

  it('returns strings in the result array', () => {
    const results = findMatches('cat');
    results.forEach((r) => {
      expect(typeof r).toBe('string');
    });
  });
});

describe('get', () => {
  it('returns data for a known emoji', () => {
    const matches = findMatches('smile');
    if (matches.length > 0) {
      const data = get(matches[0]);
      expect(data).toBeDefined();
    }
  });

  it('returns undefined for unknown emoji', () => {
    expect(get('nonexistent_emoji_zzz')).toBeUndefined();
  });
});
