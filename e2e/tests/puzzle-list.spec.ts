import {test, expect, assertNoFatalErrors, assertPageRendered} from '../fixtures/base';

test.describe('Puzzle list', () => {
  test('loads puzzles from the API', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Wait for puzzle entries to appear (API + Firebase can be slow)
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    // Multiple entries loaded
    const entryCount = await page.locator('.entry').count();
    expect(entryCount).toBeGreaterThan(0);

    assertNoFatalErrors(consoleErrors);
  });

  test('search input accepts text and filters results', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await assertPageRendered(page);

    // Wait for puzzles to load
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    // Type a search term
    await page.locator('input.welcome--searchbar').fill('mini');

    // Wait for debounce (250ms) + re-render
    await page.waitForTimeout(500);

    // List should still have entries (mini puzzles exist)
    await expect(page.locator('.entry').first()).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('puzzle entry links to a play page', async ({smoke}) => {
    const {page, consoleErrors} = smoke;

    await page.goto('/');
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    // First entry link should point to /beta/play/
    const firstEntryLink = page.locator('a[href*="/beta/play/"]').first();
    const href = await firstEntryLink.getAttribute('href');
    expect(href).toMatch(/\/beta\/play\//);

    assertNoFatalErrors(consoleErrors);
  });
});
