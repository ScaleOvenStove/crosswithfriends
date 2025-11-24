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

  it('should handle single key-value pair', () => {
    const input = {
      test: 'http://example.com',
    };
    const result = parseRawUrls(input);
    expect(result).toEqual({
      test: {url: 'http://example.com'},
    });
  });

  it('should handle multiple keys', () => {
    const input = {
      key1: 'url1',
      key2: 'url2',
      key3: 'url3',
    };
    const result = parseRawUrls(input);
    expect(result).toEqual({
      key1: {url: 'url1'},
      key2: {url: 'url2'},
      key3: {url: 'url3'},
    });
  });

  it('should preserve all keys from input', () => {
    const input = {
      a: 'url1',
      b: 'url2',
      c: 'url3',
    };
    const result = parseRawUrls(input);
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
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

  it('should handle non-URL string values', () => {
    const input = {
      a: 'not a url',
    };
    const result = parseRawUrls(input);
    expect(result).toEqual({
      a: {url: 'not a url'},
    });
  });
});


