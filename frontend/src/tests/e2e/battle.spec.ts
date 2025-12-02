import {test, expect} from '../fixtures';

test.describe('Battle Page', () => {
  test('should load battle page with battle ID', async ({page}) => {
    // Arrange & Act
    await page.goto('/beta/battle/test-battle-id');

    // Assert
    await expect(page).toHaveURL(/\/battle\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display battle interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/beta/battle/test-battle-id');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
