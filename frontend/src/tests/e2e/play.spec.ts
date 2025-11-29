import {test, expect} from '../fixtures';

test.describe('Play Page', () => {
  test('should load play page with puzzle ID', async ({page}) => {
    // Arrange & Act
    await page.goto('/beta/play/test-puzzle-id');

    // Assert
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display play interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/beta/play/test-puzzle-id');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
