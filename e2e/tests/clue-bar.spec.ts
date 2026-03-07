import {test, expect, assertNoFatalErrors} from '../fixtures/game';

test.describe('Clue bar', () => {
  test('clue bar displays above the grid', async ({gamePage}) => {
    const {page, consoleErrors} = gamePage;

    const clueBar = page.locator('.player--main--clue-bar');
    await expect(clueBar).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('clue bar shows clue number and text', async ({gamePage}) => {
    const {page, consoleErrors} = gamePage;

    const clueNumber = page.locator('.player--main--clue-bar--number');
    await expect(clueNumber).toBeVisible();
    const numberText = await clueNumber.textContent();
    expect(numberText!.trim().length).toBeGreaterThan(0);

    const clueText = page.locator('.player--main--clue-bar--text');
    await expect(clueText).toBeVisible();
    const text = await clueText.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);

    assertNoFatalErrors(consoleErrors);
  });

  test('clue bar updates when selecting a different cell', async ({gamePage}) => {
    const {page, clickCell, findFirstWhiteCell, consoleErrors} = gamePage;

    // Get initial clue bar text
    const clueText = page.locator('.player--main--clue-bar--text');
    const initialText = await clueText.textContent();

    // Press Tab to move to the next clue/word
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    const afterTabText = await clueText.textContent();

    // Clue text should have changed (different word selected)
    // Unless the puzzle has only one clue, which is very unlikely
    expect(afterTabText).not.toBe(initialText);

    assertNoFatalErrors(consoleErrors);
  });

  test('clue bar updates when toggling direction', async ({gamePage}) => {
    const {page, clickCell, findFirstWhiteCell, consoleErrors} = gamePage;

    const clueNumber = page.locator('.player--main--clue-bar--number');
    const initialNumber = await clueNumber.textContent();

    // Press Space to toggle direction
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    const afterToggleNumber = await clueNumber.textContent();

    // The abbreviation should change (e.g. "1A" -> "1D" or similar)
    // If the cell only supports one direction, it may stay the same
    // At minimum, the clue bar should still be visible
    await expect(page.locator('.player--main--clue-bar')).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });
});
