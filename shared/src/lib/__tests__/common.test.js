import {describe, it, expect} from 'vitest';
import {parseRawUrls} from '../common';

describe('parseRawUrls', () => {
  it('should transform object with string values to object with url property', () => {
    const input = {
      a: 'http://example.com',
      b: 'https://test.com',
    };
    const result = parseRawUrls(input);
    expect(result).toEqual({
      a: {url: 'http://example.com'},
      b: {url: 'https://test.com'},
    });
  });

  it('should handle empty object', () => {
    const input = {};
    const result = parseRawUrls(input);
    expect(result).toEqual({});
  });

  it('should handle empty string values', () => {
    const input = {
      a: '',
    };
    const result = parseRawUrls(input);
    expect(result).toEqual({
      a: {url: ''},
    });
  });
});
