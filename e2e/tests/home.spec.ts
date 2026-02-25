import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

test.describe('Home page', () => {
  test('renders the welcome page with nav and puzzle list', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Nav bar with site name
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.nav--left a')).toContainText('Cross with Friends');

    // User menu trigger
    await expect(page.locator('.nav--user-menu--trigger')).toBeVisible();

    // Welcome page container
    await expect(page.locator('.welcome')).toBeVisible();

    // Search bar input
    await expect(page.locator('input.welcome--searchbar')).toBeVisible();

    // Filter sidebar (desktop viewport)
    await expect(page.locator('.welcome--sidebar')).toBeVisible();

    // At least one filter checkbox group
    await expect(page.locator('.checkbox-group').first()).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('page title is correct', async ({smoke}) => {
    const {page} = smoke;
    await page.goto('/');
    await expect(page).toHaveTitle('Cross with Friends');
  });
});
