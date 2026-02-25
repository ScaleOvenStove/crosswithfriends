import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

test.describe('Navigation', () => {
  test('nav logo links to home page', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/privacy');
    await assertPageRendered(page);

    // Click the logo/site name link
    await page.locator('.nav--left a').click();

    // Should navigate to home (may redirect to www.)
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.welcome')).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('footer links navigate correctly', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/help');
    await assertPageRendered(page);

    // Privacy Policy link
    await page.locator('.footer--links a', {hasText: 'Privacy Policy'}).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('h1')).toContainText('Privacy Policy');

    // Terms of Service link
    await page.locator('.footer--links a', {hasText: 'Terms of Service'}).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator('h1')).toContainText('Terms of Service');

    // Help link
    await page.locator('.footer--links a', {hasText: 'Help'}).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.locator('h1')).toContainText('Help & FAQ');

    assertNoFatalErrors(consoleErrors);
  });

  test('user menu opens with expected items for unauthenticated user', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Open user menu
    await page.locator('.nav--user-menu--trigger').click();
    await expect(page.locator('.nav--user-menu--dropdown')).toBeVisible();

    // Unauthenticated items
    await expect(page.locator('.nav--user-menu--item', {hasText: 'Sign Up / Log In'})).toBeVisible();
    await expect(page.locator('.nav--user-menu--dark-mode')).toBeVisible();
    await expect(page.locator('.nav--user-menu--item', {hasText: 'About'})).toBeVisible();
    await expect(page.locator('.nav--user-menu--item', {hasText: 'Help'})).toBeVisible();

    // Should NOT show authenticated items
    await expect(page.locator('.nav--user-menu--item', {hasText: 'Settings'})).not.toBeVisible();
    await expect(page.locator('.nav--user-menu--item', {hasText: 'Log out'})).not.toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('user menu Help link navigates to /help', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Open user menu and click Help
    await page.locator('.nav--user-menu--trigger').click();
    await expect(page.locator('.nav--user-menu--dropdown')).toBeVisible();
    await page.locator('.nav--user-menu--item', {hasText: 'Help'}).click();

    await expect(page).toHaveURL(/\/help$/);
    await expect(page.locator('h1')).toContainText('Help & FAQ');

    assertNoFatalErrors(consoleErrors);
  });
});
