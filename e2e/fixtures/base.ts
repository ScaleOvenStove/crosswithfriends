import {test as base, expect, Page} from '@playwright/test';

export interface SmokeHelpers {
  page: Page;
  consoleErrors: string[];
}

export const test = base.extend<{smoke: SmokeHelpers}>({
  smoke: async ({page}, use) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await use({page, consoleErrors});
  },
});

export {expect};

/**
 * Assert no fatal React errors occurred (blank page, crash).
 * Filters out known benign warnings.
 */
export function assertNoFatalErrors(consoleErrors: string[]) {
  const fatal = consoleErrors.filter(
    (e) =>
      !e.includes('Warning:') &&
      !e.includes('DevTools') &&
      !e.includes('favicon') &&
      !e.includes('third-party cookie') &&
      !e.includes('WebSocket') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('the server responded with a status of') &&
      !e.includes('Viewport argument key')
  );
  expect(fatal).toEqual([]);
}

/**
 * Assert the page rendered meaningful content (not a blank white page).
 */
export async function assertPageRendered(page: Page) {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.router-wrapper')).toBeVisible();
}
