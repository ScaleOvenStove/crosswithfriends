import {test, expect, assertNoFatalErrors} from '../fixtures/game';

test.describe('Clue panel', () => {
  test('ACROSS and DOWN clue sections render', async ({gamePage}) => {
    const {page, consoleErrors} = gamePage;

    // Both direction titles should be visible
    const titles = page.locator('.clues--list--title');
    await expect(titles).toHaveCount(2);
    await expect(titles.nth(0)).toHaveText('ACROSS');
    await expect(titles.nth(1)).toHaveText('DOWN');

    // Clue entries should be present in both sections
    const acrossClues = page.locator('.clues--list--scroll.across .clues--list--scroll--clue');
    const downClues = page.locator('.clues--list--scroll.down .clues--list--scroll--clue');
    expect(await acrossClues.count()).toBeGreaterThan(0);
    expect(await downClues.count()).toBeGreaterThan(0);

    assertNoFatalErrors(consoleErrors);
  });

  test('clicking a clue selects it and highlights grid cells', async ({gamePage}) => {
    const {page, consoleErrors} = gamePage;

    // Click the second across clue (first might already be selected)
    const acrossClues = page.locator('.clues--list--scroll.across .clues--list--scroll--clue');
    const clueCount = await acrossClues.count();
    const clueToClick = clueCount > 1 ? acrossClues.nth(1) : acrossClues.first();

    await clueToClick.click();
    await page.waitForTimeout(300);

    // The clicked clue should get the .selected class
    await expect(clueToClick).toHaveClass(/selected/);

    // Grid should have highlighted cells for the selected word
    const highlightedCells = page.locator('.cell.highlighted');
    expect(await highlightedCells.count()).toBeGreaterThan(0);

    // A cell should be selected
    const selectedCells = page.locator('.cell.selected');
    await expect(selectedCells.first()).toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });

  test('selected clue follows grid cell selection', async ({gamePage}) => {
    const {clickCell, findFirstWhiteCell, page, consoleErrors} = gamePage;

    // Click the first white cell
    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);
    await page.waitForTimeout(300);

    // A clue should be selected
    const selectedClue1 = page.locator('.clues--list--scroll--clue.selected');
    await expect(selectedClue1.first()).toBeVisible();
    const clueText1 = await selectedClue1.first().textContent();

    // Press Tab to move to a different clue/word
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // The selected clue should have changed
    const selectedClue2 = page.locator('.clues--list--scroll--clue.selected');
    await expect(selectedClue2.first()).toBeVisible();
    const clueText2 = await selectedClue2.first().textContent();

    // Clue text should differ (different clue selected)
    // Unless the puzzle only has one clue, which is very unlikely
    expect(clueText1).not.toBe(clueText2);

    assertNoFatalErrors(consoleErrors);
  });

  test('clue entries show number and text', async ({gamePage}) => {
    const {page, consoleErrors} = gamePage;

    // Check the first across clue has a number and text
    const firstClue = page.locator('.clues--list--scroll.across .clues--list--scroll--clue').first();

    const number = firstClue.locator('.clues--list--scroll--clue--number');
    await expect(number).toBeVisible();
    const numberText = await number.textContent();
    expect(numberText!.trim().length).toBeGreaterThan(0);

    const text = firstClue.locator('.clues--list--scroll--clue--text');
    await expect(text).toBeVisible();
    const clueTextContent = await text.textContent();
    expect(clueTextContent!.trim().length).toBeGreaterThan(0);

    assertNoFatalErrors(consoleErrors);
  });
});
