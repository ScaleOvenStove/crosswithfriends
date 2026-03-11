import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

test.describe('Game page', () => {
  test('navigating to a puzzle from the list loads the game page', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Wait for puzzle entries to load
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    // Get the first puzzle link
    const firstPuzzleLink = page.locator('a[href*="/beta/play/"]').first();
    const href = await firstPuzzleLink.getAttribute('href');
    expect(href).toBeTruthy();

    // Navigate to the puzzle
    await page.goto(href!);
    await assertPageRendered(page);

    // Game page should render .room container
    await expect(page.locator('.room')).toBeVisible({timeout: 15_000});

    // Nav should be present
    await expect(page.locator('.nav')).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('game page does not show a blank screen', async ({smoke}) => {
    const {page} = smoke;

    await page.goto('/');
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    const firstPuzzleLink = page.locator('a[href*="/beta/play/"]').first();
    await firstPuzzleLink.click();

    // Wait for game page to load
    await expect(page.locator('.room')).toBeVisible({timeout: 15_000});

    // Root should have content
    const rootContent = await page.locator('#root').innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
  });
});
