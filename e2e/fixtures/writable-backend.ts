import {expect, Page} from '@playwright/test';

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
 *
 * Note that the env var only states which dev server Playwright would START.
 * It is not by itself proof of what is answering on the port — see
 * `reuseExistingServer` in playwright.config.ts, and assertLocalBackend below,
 * which checks the app that actually loaded.
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

/**
 * Fail if the app being served is not pointed at a loopback backend.
 *
 * Belt and braces behind `reuseExistingServer` in playwright.config.ts.
 * VITE_USE_LOCAL_SERVER only describes the dev server Playwright would START;
 * it says nothing about what is actually answering on the port, and the backend
 * host is baked into the bundle at build time. This reads what the loaded app
 * resolved.
 *
 * It navigates to "/" rather than a game page on purpose: this has to run
 * BEFORE anything that writes, and the home page creates no socket (so the
 * signal is the host that src/api/constants.ts logs on every page load, not a
 * live connection). Checked once per process — the answer cannot change within
 * a run.
 *
 * Only meaningful for loopback runs; an allowlisted deployment serves its own
 * frontend pointed at its own backend.
 */
let localBackendCheck: Promise<void> | null = null;

export function assertLocalBackend(page: Page, baseURL: string | undefined): Promise<void> {
  if (!isLoopback(normalize(baseURL || ''))) return Promise.resolve();
  if (!localBackendCheck) localBackendCheck = runLocalBackendCheck(page);
  return localBackendCheck;
}

async function runLocalBackendCheck(page: Page): Promise<void> {
  const marker = 'Frontend Socket at:';
  let resolvedHost: string | null = null;

  page.on('console', (msg) => {
    const text = msg.text();
    if (resolvedHost === null && text.includes(marker)) {
      resolvedHost = text.slice(text.indexOf(marker) + marker.length).trim();
    }
  });

  await page.goto('/');
  await expect
    .poll(() => resolvedHost, {timeout: 20_000, message: `Never saw "${marker}" logged by the app`})
    .not.toBeNull();

  if (!isLoopback(resolvedHost as unknown as string)) {
    throw new Error(
      `Refusing to run write-heavy specs: the frontend on this port is pointed at ` +
        `${resolvedHost}, not a local backend. A dev server started with \`pnpm start\` proxies ` +
        `to production. Stop it and let Playwright start \`pnpm devfrontend\` itself.`
    );
  }
}
