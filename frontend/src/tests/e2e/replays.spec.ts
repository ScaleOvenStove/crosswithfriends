import {test, expect} from '../fixtures';

test.describe('Replays Page', () => {
  test('should load replays page', async ({page}) => {
    // Arrange & Act
    await page.goto('/replays');

    // Assert
    await expect(page).toHaveURL(/\/replays/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load replays page with puzzle ID', async ({page}) => {
    // Arrange & Act
    await page.goto('/replays/test-puzzle-id');

    // Assert
    await expect(page).toHaveURL(/\/replays\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display replays interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/replays');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
