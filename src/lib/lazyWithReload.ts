import * as React from 'react';
import * as Sentry from '@sentry/react';

const RELOAD_MARKER_KEY = 'cwf_chunk_reload';

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Unable to preload CSS/i.test(msg)
  );
}

function readMarker(): string | null {
  try {
    return window.sessionStorage.getItem(RELOAD_MARKER_KEY);
  } catch {
    return null;
  }
}

function writeMarker(): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (privacy mode, full quota); proceed without dedup.
  }
}

export function clearChunkReloadMarker(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_MARKER_KEY);
  } catch {
    // ignore
  }
}

export function handleImportError<T>(err: unknown): Promise<T> {
  if (!isChunkLoadError(err)) throw err;

  if (readMarker()) {
    // Already reloaded once this session; the asset is genuinely missing.
    Sentry.captureException(err, {tags: {chunkLoadReloadExhausted: 'true'}});
    throw err;
  }

  writeMarker();
  Sentry.logger.info('Reloading after chunk load failure', {
    message: err instanceof Error ? err.message : String(err),
  });
  window.location.reload();
  // Hold Suspense in its loading state until the reload navigates away.
  return new Promise<T>(() => {});
}

export function lazyWithReload<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{default: T}>
): React.LazyExoticComponent<T> {
  return React.lazy(() => factory().catch(handleImportError<{default: T}>));
}
