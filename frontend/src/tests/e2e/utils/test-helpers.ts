import type {Page} from '@playwright/test';

/**
 * Test helper utilities for common operations
 */

/**
 * Wait for a network request to complete
 * Prefer using auto-waiting, but this can be useful for specific API calls
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: {timeout?: number}
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    {timeout: options?.timeout ?? 10000}
  );
}

/**
 * Wait for page to be fully interactive
 * Use this sparingly - prefer auto-waiting on specific elements
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Wait for any loading spinners to disappear
  const loadingSpinner = page.locator('[data-testid="loading"]').or(page.locator('.loading-spinner'));
  await loadingSpinner.waitFor({state: 'hidden', timeout: 5000}).catch(() => {
    // Loading spinner might not exist, which is fine
  });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({path: `test-results/screenshots/${name}-${Date.now()}.png`, fullPage: true});
}

/**
 * Check if an element exists without throwing
 */
export async function elementExists(page: Page, selector: string, timeout = 2000): Promise<boolean> {
  try {
    await page.locator(selector).waitFor({state: 'visible', timeout});
    return true;
  } catch {
    return false;
  }
}

/**
 * Get text content safely (returns null if element doesn't exist)
 */
export async function getTextContentSafely(page: Page, selector: string): Promise<string | null> {
  const element = page.locator(selector);
  if (await element.isVisible({timeout: 2000}).catch(() => false)) {
    return await element.textContent();
  }
  return null;
}




