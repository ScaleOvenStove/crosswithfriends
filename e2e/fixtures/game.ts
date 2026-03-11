import {test as base, expect, Page, Locator} from '@playwright/test';

export interface GameHelpers {
  page: Page;
  consoleErrors: string[];
  /** True when the puzzle is a contest (Check/Reveal buttons are hidden) */
  isContest: boolean;
  /** Click a cell by row and column (space-separated in data-rc attr) */
  clickCell: (r: number, c: number) => Promise<void>;
  /** Get the text content of the .cell--value inside a cell */
  getCellValue: (r: number, c: number) => Promise<string>;
  /** Check if the .cell div inside a td has a given class */
  cellHasClass: (r: number, c: number, cls: string) => Promise<boolean>;
  /** Press a single key on the keyboard */
  typeLetter: (letter: string) => Promise<void>;
  /** Click an action menu button by its label text (e.g. "Check", "Reveal", "Reset") */
  openActionMenu: (label: string) => Promise<void>;
  /** Click an action inside an open action menu by its data-action-key */
  clickAction: (key: string) => Promise<void>;
  /** Get the cell td locator for a given row and column */
  cellLocator: (r: number, c: number) => Locator;
  /** Find and return the first white (non-black) cell's {r, c} */
  findFirstWhiteCell: () => Promise<{r: number; c: number}>;
}

/**
 * Fixture that navigates to a puzzle, waits for the game to load,
 * clicks the first white cell to activate the grid, and provides helpers.
 */
export const test = base.extend<{gamePage: GameHelpers}>({
  gamePage: async ({page}, use) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Navigate to home and wait for puzzle entries
    await page.goto('/');
    await expect(page.locator('.entry').first()).toBeVisible({timeout: 15_000});

    // Click the first puzzle link to create a game
    const firstPuzzleLink = page.locator('a[href*="/beta/play/"]').first();
    await firstPuzzleLink.click();

    // Wait for game page to load — .room container and grid table
    await expect(page.locator('.room')).toBeVisible({timeout: 15_000});
    await expect(page.locator('table.grid')).toBeVisible({timeout: 15_000});

    // Wait for grid cells to render
    await expect(page.locator('td.grid--cell').first()).toBeVisible({timeout: 10_000});

    // Helper implementations
    const cellLocator = (r: number, c: number): Locator => {
      return page.locator(`td.grid--cell[data-rc="${r} ${c}"]`);
    };

    const findFirstWhiteCell = async (): Promise<{r: number; c: number}> => {
      // Single evaluate() call to avoid N round-trips over remote connections
      const rc = await page.evaluate(() => {
        const cells = document.querySelectorAll('td.grid--cell');
        for (const cell of cells) {
          const cellDiv = cell.querySelector('.cell');
          if (cellDiv && !cellDiv.classList.contains('black')) {
            return cell.getAttribute('data-rc');
          }
        }
        return null;
      });
      if (!rc) throw new Error('No white cells found in grid');
      const [r, c] = rc.split(' ').map(Number);
      return {r, c};
    };

    const clickCell = async (r: number, c: number): Promise<void> => {
      await cellLocator(r, c).click();
    };

    const getCellValue = async (r: number, c: number): Promise<string> => {
      const valueEl = cellLocator(r, c).locator('.cell--value');
      return (await valueEl.textContent()) || '';
    };

    const cellHasClass = async (r: number, c: number, cls: string): Promise<boolean> => {
      const cellDiv = cellLocator(r, c).locator('.cell');
      return cellDiv.evaluate((el, className) => el.classList.contains(className), cls);
    };

    const typeLetter = async (letter: string): Promise<void> => {
      await page.keyboard.press(letter);
    };

    const openActionMenu = async (label: string): Promise<void> => {
      await page.locator('.action-menu--button', {hasText: label}).click();
    };

    const clickAction = async (key: string): Promise<void> => {
      // Scope to the currently active (open) action menu to avoid strict mode violations
      await page.locator(`.active.action-menu .action-menu--list--action[data-action-key="${key}"]`).click();
    };

    // Detect contest mode — contest puzzles show "Mark as Solved" instead of Check/Reveal
    const isContest = (await page.locator('.toolbar--mark-solved').count()) > 0;

    // Click the first white cell to activate the grid input
    const firstWhite = await findFirstWhiteCell();
    await clickCell(firstWhite.r, firstWhite.c);

    await use({
      page,
      consoleErrors,
      isContest,
      clickCell,
      getCellValue,
      cellHasClass,
      typeLetter,
      openActionMenu,
      clickAction,
      cellLocator,
      findFirstWhiteCell,
    });
  },
});

export {expect};

/**
 * Filter out known benign console errors.
 */
export function assertNoFatalErrors(consoleErrors: string[]) {
  const fatal = consoleErrors.filter(
    (e) =>
      !e.includes('Warning:') &&
      !e.includes('DevTools') &&
      !e.includes('favicon') &&
      !e.includes('third-party cookie') &&
      !e.includes('WebSocket') &&
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('the server responded with a status of') &&
      !e.includes('Viewport argument key')
  );
  expect(fatal).toEqual([]);
}
