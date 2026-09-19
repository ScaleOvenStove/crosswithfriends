import {defineConfig, devices} from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3020';
const isLocal = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', {open: 'never'}]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
  ],
  outputDir: './test-results',

  // When testing against localhost, start the dev server automatically.
  //
  // `pnpm start` proxies /api to the *production* backend and points
  // Socket.IO there too, so anything it writes lands in the production
  // database. Setting VITE_USE_LOCAL_SERVER switches to `pnpm devfrontend`,
  // which talks to a backend on :3021 instead — that is what CI uses, and
  // it is required for any spec that writes (game creation, multiplayer).
  ...(isLocal
    ? {
        webServer: {
          command: process.env.VITE_USE_LOCAL_SERVER ? 'pnpm devfrontend' : 'pnpm start',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }
    : {}),
});
