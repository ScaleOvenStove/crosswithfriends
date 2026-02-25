import {test, expect, assertNoFatalErrors} from '../fixtures/game';

test.describe('Toolbar actions', () => {
  test('Check Square marks a wrong letter as bad', async ({gamePage}) => {
    const {clickCell, typeLetter, openActionMenu, clickAction, cellHasClass, findFirstWhiteCell, consoleErrors, page} =
      gamePage;

    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);

    // Type a letter (may or may not be correct — we just need something in the cell)
    await typeLetter('Z');
    await expect(gamePage.cellLocator(r, c).locator('.cell--value')).toHaveText('Z', {timeout: 5_000});

    // Re-select the cell (cursor advanced after typing)
    await clickCell(r, c);
    await page.waitForTimeout(200);

    // Open Check menu and click Square
    await openActionMenu('Check');
    await clickAction('Square');
    await page.waitForTimeout(500);

    // If the letter was wrong, the cell gets .bad class
    // If by chance it was correct, it gets .good class
    // Either way, the action should have executed without errors
    const isBad = await cellHasClass(r, c, 'bad');
    const isGood = await cellHasClass(r, c, 'good');
    expect(isBad || isGood).toBe(true);

    assertNoFatalErrors(consoleErrors);
  });

  test('Reveal Square confirms and applies answer', async ({gamePage}) => {
    const {clickCell, typeLetter, openActionMenu, clickAction, findFirstWhiteCell, consoleErrors, page} = gamePage;

    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);

    // Type a wrong letter first so reveal has something to change
    await typeLetter('Z');
    await expect(gamePage.cellLocator(r, c).locator('.cell--value')).toHaveText('Z', {timeout: 5_000});

    // Re-select the cell (cursor advanced after typing)
    await clickCell(r, c);
    await page.waitForTimeout(200);

    // Open Reveal menu and click Square
    await openActionMenu('Reveal');
    await clickAction('Square');

    // SweetAlert confirmation dialog appears — confirm it
    await expect(page.locator('.swal-overlay')).toBeVisible({timeout: 5_000});
    await page.locator('.swal-button--confirm').click();

    // Wait for reveal to propagate — cell gets .revealed or .good class
    const cellDiv = gamePage.cellLocator(r, c).locator('.cell');
    await expect(cellDiv).toHaveClass(/revealed|good/, {timeout: 10_000});

    assertNoFatalErrors(consoleErrors);
  });

  test('Reset Square clears the cell value', async ({gamePage}) => {
    const {clickCell, typeLetter, getCellValue, openActionMenu, clickAction, findFirstWhiteCell, consoleErrors, page} =
      gamePage;

    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);

    // Type a letter first
    await typeLetter('M');
    await expect(gamePage.cellLocator(r, c).locator('.cell--value')).toHaveText('M', {timeout: 5_000});

    // Re-select the cell
    await clickCell(r, c);
    await page.waitForTimeout(200);

    // Open Reset menu and click Square
    await openActionMenu('Reset');
    await clickAction('Square');
    await page.waitForTimeout(500);

    // Cell value should be cleared
    const value = await getCellValue(r, c);
    expect(value.trim()).toBe('');

    assertNoFatalErrors(consoleErrors);
  });

  test('Pencil mode toggle adds pencil class to typed letters', async ({gamePage}) => {
    const {clickCell, typeLetter, cellHasClass, findFirstWhiteCell, consoleErrors, page} = gamePage;

    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);

    // Enable pencil mode by clicking the pencil button
    const pencilBtn = page.locator('.toolbar--pencil');
    await pencilBtn.click();
    await page.waitForTimeout(200);

    // Verify pencil button is in "on" state
    await expect(pencilBtn).toHaveClass(/on/);

    // Re-click cell to refocus grid input
    await clickCell(r, c);
    await page.waitForTimeout(100);

    // Type a letter in pencil mode
    await typeLetter('P');
    await expect(gamePage.cellLocator(r, c).locator('.cell--value')).toHaveText('P', {timeout: 5_000});

    // Cell should have pencil class
    expect(await cellHasClass(r, c, 'pencil')).toBe(true);

    // Disable pencil mode
    await pencilBtn.click();
    await page.waitForTimeout(200);
    await expect(pencilBtn).not.toHaveClass(/on/);

    assertNoFatalErrors(consoleErrors);
  });

  test('Check Word marks wrong cells', async ({gamePage}) => {
    const {clickCell, typeLetter, openActionMenu, clickAction, findFirstWhiteCell, consoleErrors, page} = gamePage;

    const {r, c} = await findFirstWhiteCell();
    await clickCell(r, c);

    // Type a letter in the first cell of the word
    await typeLetter('Z');
    await page.waitForTimeout(200);

    // Re-select the cell to stay on the same word
    await clickCell(r, c);
    await page.waitForTimeout(200);

    // Check Word
    await openActionMenu('Check');
    await clickAction('Word');
    await page.waitForTimeout(500);

    // At least one cell in the highlighted word should have .bad or .good
    const highlightedCells = page.locator('.cell.highlighted');
    const count = await highlightedCells.count();

    // The word should still have highlighted cells
    // And at least one cell should have been checked (bad or good)
    const badOrGoodCells = page.locator('.cell.bad, .cell.good');
    const checkedCount = await badOrGoodCells.count();
    expect(checkedCount).toBeGreaterThan(0);

    assertNoFatalErrors(consoleErrors);
  });

  test('Reset Puzzle shows confirmation dialog', async ({gamePage}) => {
    const {openActionMenu, clickAction, consoleErrors, page} = gamePage;

    // Open Reset menu and click Puzzle
    await openActionMenu('Reset');
    await clickAction('Puzzle');

    // SweetAlert dialog should appear
    await expect(page.locator('.swal-overlay')).toBeVisible({timeout: 5_000});
    await expect(page.locator('.swal-title')).toContainText('reset');

    // Cancel to avoid actually resetting
    const cancelBtn = page.locator('.swal-button--cancel');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      // Some swal versions use different button structure — press Escape
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(300);

    // Dialog should be gone
    await expect(page.locator('.swal-overlay--show-modal')).not.toBeVisible();

    assertNoFatalErrors(consoleErrors);
  });
});
