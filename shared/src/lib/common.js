// input { a: 'bcd', ... }
// returns { a: { url: 'bcd' }, ... }
export const parseRawUrls = (urls) =>
  Object.keys(urls).reduce(
    (r, key) => ({
      ...r,
      [key]: {
        url: urls[key],
      },
    }),
    {}
  );
