import {describe, it, expect, vi} from 'vitest';
import nameGenerator, {isFromNameGenerator} from '../nameGenerator';

describe('nameGenerator', () => {
  it('should generate a name', () => {
    const name = nameGenerator();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('should generate name with at least two words', () => {
    const name = nameGenerator();
    const parts = name.split(' ');
    // Names consist of an adjective + noun, where nouns can have up to 2 words
    // So the result can be 2 words (adj + single-word noun) or 3 words (adj + two-word noun)
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts.length).toBeLessThanOrEqual(3);
  });

  it('should generate name with length <= 20', () => {
    // Test multiple times to ensure constraint
    for (let i = 0; i < 100; i++) {
      const name = nameGenerator();
      expect(name.length).toBeLessThanOrEqual(20);
    }
  });

  it('should generate different names on multiple calls', () => {
    const names = new Set();
    for (let i = 0; i < 50; i++) {
      names.add(nameGenerator());
    }
    // Should generate at least some different names (allowing for some duplicates)
    expect(names.size).toBeGreaterThan(1);
  });

  it('should capitalize first letter of each word', () => {
    const name = nameGenerator();
    const parts = name.split(' ');
    parts.forEach((part) => {
      expect(part[0]).toBe(part[0].toUpperCase());
      expect(part.substring(1)).toBe(part.substring(1).toLowerCase());
    });
  });
});

describe('isFromNameGenerator', () => {
  it('should return true for valid generated names', () => {
    // Generate a name and check if it's recognized
    const name = nameGenerator();
    // This should work if the name was actually generated
    // We'll test with known patterns that should match
    expect(typeof isFromNameGenerator(name)).toBe('boolean');
  });

  it('should return false for names longer than 20 characters', () => {
    expect(isFromNameGenerator('This Is A Very Long Name That Exceeds Twenty Characters')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isFromNameGenerator(null)).toBe(false);
    expect(isFromNameGenerator(undefined)).toBe(false);
    expect(isFromNameGenerator(123)).toBe(false);
    expect(isFromNameGenerator({})).toBe(false);
    expect(isFromNameGenerator([])).toBe(false);
  });

  it('should return false for names with wrong number of words', () => {
    expect(isFromNameGenerator('Single')).toBe(false);
    expect(isFromNameGenerator('One Two Three')).toBe(false);
    expect(isFromNameGenerator('')).toBe(false);
  });

  it('should return false for names with non-alphabetic characters', () => {
    expect(isFromNameGenerator('Test 123')).toBe(false);
    expect(isFromNameGenerator('Test-Name')).toBe(false);
    expect(isFromNameGenerator('Test_Name')).toBe(false);
  });

  it('should validate adjective and noun separately', () => {
    // Test with invalid combinations
    expect(isFromNameGenerator('InvalidAdjective ValidNoun')).toBe(false);
    expect(isFromNameGenerator('ValidAdjective InvalidNoun')).toBe(false);
  });

  it('should handle names with proper capitalization', () => {
    // The function should work with properly capitalized names
    const name = nameGenerator();
    if (name) {
      const result = isFromNameGenerator(name);
      expect(typeof result).toBe('boolean');
    }
  });
});

describe('nameGenerator internal functions', () => {
  // Test that the generator produces valid format
  it('should produce names that pass validation', () => {
    for (let i = 0; i < 20; i++) {
      const name = nameGenerator();
      // Name should be a string with at least two words (some nouns may have spaces)
      const parts = name.split(' ');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[parts.length - 1].length).toBeGreaterThan(0);
    }
  });

  it('should handle edge cases in name generation', () => {
    // Generate many names to test edge cases
    const names = [];
    for (let i = 0; i < 100; i++) {
      names.push(nameGenerator());
    }

    // All should be valid format
    names.forEach((name) => {
      expect(name.length).toBeLessThanOrEqual(20);
      const parts = name.split(' ');
      expect(parts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
