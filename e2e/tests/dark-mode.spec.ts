import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

test.describe('Dark mode', () => {
  test('toggles through dark mode states: Off -> On -> System -> Off', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    const routerWrapper = page.locator('.router-wrapper');

    // Initially dark mode should be off
    await expect(routerWrapper).not.toHaveClass(/\bdark\b/);

    // Open user menu
    await page.locator('.nav--user-menu--trigger').click();
    await expect(page.locator('.nav--user-menu--dropdown')).toBeVisible();

    // Should show "Dark Mode: Off"
    await expect(page.locator('.nav--user-menu--dark-mode')).toContainText('Dark Mode: Off');

    // Toggle to On
    await page.locator('.nav--user-menu--dark-mode').click();
    await expect(page.locator('.nav--user-menu--dark-mode')).toContainText('Dark Mode: On');
    await expect(routerWrapper).toHaveClass(/\bdark\b/);

    // Body should also have dark class
    const bodyHasDark = await page.evaluate(() => document.body.classList.contains('dark'));
    expect(bodyHasDark).toBe(true);

    // Toggle to System
    await page.locator('.nav--user-menu--dark-mode').click();
    await expect(page.locator('.nav--user-menu--dark-mode')).toContainText('Dark Mode: System');

    // Toggle back to Off
    await page.locator('.nav--user-menu--dark-mode').click();
    await expect(page.locator('.nav--user-menu--dark-mode')).toContainText('Dark Mode: Off');
    await expect(routerWrapper).not.toHaveClass(/\bdark\b/);

    assertNoFatalErrors(consoleErrors);
  });

  test('dark mode applies visual changes to the nav', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Get nav background color in light mode
    const lightNavBg = await page.locator('.nav').evaluate((el) => getComputedStyle(el).backgroundColor);

    // Toggle to dark mode
    await page.locator('.nav--user-menu--trigger').click();
    await page.locator('.nav--user-menu--dark-mode').click();
    await expect(page.locator('.router-wrapper')).toHaveClass(/\bdark\b/);

    // Get nav background color in dark mode
    const darkNavBg = await page.locator('.nav').evaluate((el) => getComputedStyle(el).backgroundColor);

    // Colors should be different
    expect(darkNavBg).not.toEqual(lightNavBg);

    assertNoFatalErrors(consoleErrors);
  });
});
