import {test, expect} from '../fixtures';

test.describe('Fencing Page', () => {
  test('should load fencing page', async ({page}) => {
    // Arrange & Act
    await page.goto('/fencing');

    // Assert
    await expect(page).toHaveURL('/fencing');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display fencing interface after loading', async ({page}) => {
    // Arrange & Act
    await page.goto('/fencing');
    await page.waitForLoadState('domcontentloaded');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Check for main content area
    const mainContent = page.locator('main').or(page.locator('[role="main"]')).or(page.getByRole('main'));
    await expect(mainContent.first()).toBeVisible({timeout: 10000});
  });
});
