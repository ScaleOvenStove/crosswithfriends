import {parseRawUrls} from '../common';

describe('parseRawUrls', () => {
  it('wraps string values in url objects', () => {
    const input = {home: '/home', about: '/about'};
    const result = parseRawUrls(input);
    expect(result).toEqual({
      home: {url: '/home'},
      about: {url: '/about'},
    });
  });

  it('returns empty object for empty input', () => {
    expect(parseRawUrls({})).toEqual({});
  });

  it('handles single entry', () => {
    expect(parseRawUrls({api: 'https://example.com'})).toEqual({
      api: {url: 'https://example.com'},
    });
  });

  it('preserves all keys', () => {
    const input = {a: '1', b: '2', c: '3'};
    const result = parseRawUrls(input);
    expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
  });
});
