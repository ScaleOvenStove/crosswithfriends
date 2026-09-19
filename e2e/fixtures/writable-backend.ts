/**
 * Which backends the write-heavy specs are allowed to run against.
 *
 * This is an allowlist on purpose. The first version of the multiplayer guard
 * was a denylist ("skip when pointed at localhost without a local server"),
 * which silently let `pnpm test:e2e:prod` (BASE_URL=https://crosswithfriends.com)
 * through — `isLocal` is false there, so nothing skipped and the suite would
 * have created games and persisted events in the production database.
 *
 * Anything not named here is treated as unsafe to write to.
 */
const WRITABLE_BACKENDS = new Set([
  // Shared testing deployment, seeded by .github/workflows/deploy-tests.yml.
  'https://testing.crosswithfriends.com',
  // The local stack CI stands up (see the e2e job in ci.yml).
  'http://localhost:3021',
  'http://127.0.0.1:3021',
]);

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function isLoopback(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * True when it is safe for a spec to create games, upload puzzles, or persist
 * events against `baseURL`.
 *
 * A loopback baseURL only qualifies when VITE_USE_LOCAL_SERVER is set: without
 * it the Vite dev server proxies /api to the production backend and points
 * Socket.IO there too, so "localhost" writes land in production.
 */
export function isWritableBackend(
  baseURL: string | undefined,
  env: {VITE_USE_LOCAL_SERVER?: string} = process.env
): boolean {
  const url = normalize(baseURL || '');
  if (!url) return false;
  if (isLoopback(url)) return !!env.VITE_USE_LOCAL_SERVER;
  return WRITABLE_BACKENDS.has(url);
}

/** Shared skip reason, so both specs explain the same thing the same way. */
export const WRITE_SKIP_REASON =
  'Skipped: this spec writes (creates games, persists events, uploads puzzles). Run it with ' +
  'VITE_USE_LOCAL_SERVER=1 against a local backend, or set BASE_URL to the testing environment. ' +
  'It never runs against production.';
