import {test, expect} from '../fixtures';

test.describe('Composition Page', () => {
  test('should load composition page with composition ID', async ({page}) => {
    // Arrange & Act
    await page.goto('/composition/test-composition-id');

    // Assert
    await expect(page).toHaveURL(/\/composition\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display composition interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/composition/test-composition-id');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
