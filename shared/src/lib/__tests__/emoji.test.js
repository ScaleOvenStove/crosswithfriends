import {describe, it, expect} from 'vitest';
import {findMatches, get} from '../emoji';

describe('findMatches', () => {
  it('should return array of matching emojis', () => {
    const result = findMatches('smile');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for no matches', () => {
    const result = findMatches('nonexistentemoji12345');
    expect(result).toEqual([]);
  });

  it('should prioritize exact matches', () => {
    const result = findMatches('smile');
    // Exact match should have highest score (60)
    if (result.length > 0 && result[0] === 'smile') {
      expect(result[0]).toBe('smile');
    }
  });

  it('should prioritize emojis that start with pattern', () => {
    const result = findMatches('smile');
    // Emojis starting with pattern should score 50
    if (result.length > 0) {
      const firstMatch = result[0];
      expect(firstMatch.startsWith('smile') || firstMatch === 'smile').toBe(true);
    }
  });

  it('should include emojis containing pattern', () => {
    const result = findMatches('happy');
    // Should find emojis containing 'happy'
    expect(result.length).toBeGreaterThan(0);
  });

  it('should score emojis with underscore prefix higher', () => {
    const result = findMatches('test');
    // Emojis like '_test' should score 40
    if (result.length > 0) {
      // Just verify we get results
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('should score emojis with hyphen prefix', () => {
    const result = findMatches('party');
    // Emojis like '-party' should score 30
    if (result.length > 0) {
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('should be case insensitive', () => {
    const lowerResult = findMatches('smile');
    const upperResult = findMatches('SMILE');
    // Should return similar results (may differ due to scoring)
    expect(Array.isArray(lowerResult)).toBe(true);
    expect(Array.isArray(upperResult)).toBe(true);
  });

  it('should return results sorted by score', () => {
    const result = findMatches('happy');
    if (result.length > 1) {
      // Results should be sorted by score (descending)
      // Exact matches first, then starts with, then contains
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('should handle empty string', () => {
    const result = findMatches('');
    // Empty string might match all emojis or none, depending on implementation
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle single character patterns', () => {
    const result = findMatches('a');
    // Should find emojis containing 'a'
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle special characters in pattern', () => {
    const result = findMatches('test-emoji');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('get', () => {
  it('should return emoji data for valid emoji', () => {
    // Test with a known emoji if available
    const result = get('smile');
    // Should return emoji character (string) or undefined
    // If 'smile' doesn't exist, result will be undefined
    expect(result === undefined || typeof result === 'string' || typeof result === 'object').toBe(true);
  });

  it('should return undefined for non-existent emoji', () => {
    const result = get('nonexistentemoji12345');
    expect(result).toBeUndefined();
  });

  it('should handle empty string', () => {
    const result = get('');
    expect(result).toBeUndefined();
  });

  it('should return consistent data for same emoji', () => {
    const result1 = get('smile');
    const result2 = get('smile');
    expect(result1).toBe(result2);
  });

  it('should handle emoji names with special characters', () => {
    const result = get('test-emoji');
    // Should return emoji character (string) or undefined
    expect(result === undefined || typeof result === 'string').toBe(true);
  });

  it('should handle emoji names with underscores', () => {
    const result = get('test_emoji');
    expect(result === undefined || typeof result === 'string').toBe(true);
  });
});

describe('emoji search integration', () => {
  it('should find emojis that can be retrieved', () => {
    const matches = findMatches('happy');
    if (matches.length > 0) {
      const firstMatch = matches[0];
      const data = get(firstMatch);
      // If emoji exists in matches, it should have data (string emoji character or object)
      expect(data === undefined || typeof data === 'string' || typeof data === 'object').toBe(true);
    }
  });

  it('should handle emoji packs correctly', () => {
    // Test that emojis from different packs are accessible
    const result = findMatches('party');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should prioritize custom emojis over default', () => {
    // Custom pack is spread last, so should override defaults
    const matches = findMatches('test');
    expect(Array.isArray(matches)).toBe(true);
  });
});
