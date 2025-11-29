import {test, expect} from '../fixtures';

test.describe('Compose Page', () => {
  test('should load compose page', async ({page}) => {
    // Arrange & Act
    await page.goto('/compose');

    // Assert
    await expect(page).toHaveURL('/compose');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display compose interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/compose');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
