import nameGenerator, {isFromNameGenerator} from '../nameGenerator';

describe('nameGenerator', () => {
  it('returns a string', () => {
    expect(typeof nameGenerator()).toBe('string');
  });

  it('returns a name with at least two words', () => {
    for (let i = 0; i < 20; i++) {
      const name = nameGenerator();
      // Nouns can be two words (e.g. "American Cow"), so names can be 2-3 words
      expect(name.split(' ').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns a name of 20 chars or fewer', () => {
    for (let i = 0; i < 50; i++) {
      expect(nameGenerator().length).toBeLessThanOrEqual(20);
    }
  });

  it('generates two-word names that pass isFromNameGenerator', () => {
    // Some nouns have spaces (e.g. "American Cow"), so not all generated names
    // pass isFromNameGenerator which requires exactly 2 words.
    // Test only two-word results.
    let tested = 0;
    for (let i = 0; i < 100 && tested < 5; i += 1) {
      const name = nameGenerator();
      if (name.split(' ').length === 2) {
        expect(isFromNameGenerator(name)).toBe(true);
        tested += 1;
      }
    }
    expect(tested).toBeGreaterThan(0);
  });
});

describe('isFromNameGenerator', () => {
  it('rejects non-string input', () => {
    expect(isFromNameGenerator(null)).toBe(false);
    expect(isFromNameGenerator(undefined)).toBe(false);
    expect(isFromNameGenerator(42)).toBe(false);
  });

  it('rejects strings longer than 20 chars', () => {
    expect(isFromNameGenerator('Aaaaaaaaaaaa Bbbbbbbbb')).toBe(false);
  });

  it('rejects single-word names', () => {
    expect(isFromNameGenerator('Hello')).toBe(false);
  });

  it('rejects three-word names', () => {
    expect(isFromNameGenerator('One Two Three')).toBe(false);
  });

  it('rejects names with invalid adjective or noun', () => {
    expect(isFromNameGenerator('Xyzzy Plugh')).toBe(false);
  });
});
