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

  // When testing against localhost, start the dev server automatically
  ...(isLocal
    ? {
        webServer: {
          command: 'pnpm start',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }
    : {}),
});
