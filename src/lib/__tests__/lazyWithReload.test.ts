import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const captureException = vi.fn();
const loggerInfo = vi.fn();

vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  logger: {info: (...args: unknown[]) => loggerInfo(...args)},
}));

import {clearChunkReloadMarker, handleImportError, isChunkLoadError} from '../lazyWithReload';

const RELOAD_MARKER_KEY = 'cwf_chunk_reload';

describe('isChunkLoadError', () => {
  it('matches Vite/Chrome dynamic import failures', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://www.crosswithfriends.com/assets/Play-_Z5EQQwl.js'
        )
      )
    ).toBe(true);
  });

  it('matches Firefox phrasing', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('matches Safari phrasing', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
  });

  it('matches CSS preload failures', () => {
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/foo.css'))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('handleImportError', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    captureException.mockClear();
    loggerInfo.mockClear();
    window.sessionStorage.clear();
    // jsdom's window.location.reload is non-configurable, so swap the whole
    // location object for a stub that exposes only what we need.
    originalLocation = window.location;
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {...originalLocation, reload: reloadSpy},
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('rethrows non-chunk errors without reloading', () => {
    const err = new Error('Cannot read properties of undefined');
    expect(() => handleImportError(err)).toThrow(err);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(RELOAD_MARKER_KEY)).toBeNull();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('triggers a reload on first chunk-load failure and holds Suspense pending', async () => {
    const err = new TypeError('Failed to fetch dynamically imported module: ...Play.js');
    const result = handleImportError(err);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RELOAD_MARKER_KEY)).not.toBeNull();
    expect(loggerInfo).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();

    // The returned promise should never resolve or reject (Suspense stays in
    // loading until the browser navigates away). Race it against a tick.
    const race = await Promise.race([result, Promise.resolve('still-pending')]);
    expect(race).toBe('still-pending');
  });

  it('reports to Sentry and rethrows when already reloaded once this session', () => {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now() - 1000));
    const err = new TypeError('Failed to fetch dynamically imported module: ...Play.js');

    expect(() => handleImportError(err)).toThrow(err);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: {chunkLoadReloadExhausted: 'true'},
    });
  });
});

describe('clearChunkReloadMarker', () => {
  it('removes the session marker', () => {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, '123');
    clearChunkReloadMarker();
    expect(window.sessionStorage.getItem(RELOAD_MARKER_KEY)).toBeNull();
  });

  it('is a no-op when no marker is set', () => {
    expect(() => clearChunkReloadMarker()).not.toThrow();
  });
});
