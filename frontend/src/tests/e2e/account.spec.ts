import {test, expect} from '../fixtures';

test.describe('Account Page', () => {
  test('should load account page', async ({page}) => {
    // Arrange & Act
    await page.goto('/account');

    // Assert
    await expect(page).toHaveURL('/account');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display account interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
