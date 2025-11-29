import type {Page, Locator} from '@playwright/test';

/**
 * Page Object Model for the Game page
 * Encapsulates all interactions with the crossword game interface
 */
export class GamePage {
  readonly page: Page;
  readonly grid: Locator;
  readonly acrossClues: Locator;
  readonly downClues: Locator;
  readonly checkButton: Locator;
  readonly revealButton: Locator;
  readonly resetButton: Locator;
  readonly timer: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use test IDs when available, fallback to semantic selectors including .grid class
    this.grid = page
      .locator('[data-testid="crossword-grid"]')
      .or(page.locator('.grid'))
      .or(page.locator('.crossword-grid'))
      .or(page.locator('table.grid'))
      .first();
    this.acrossClues = page
      .locator('[data-testid="across-clues"]')
      .or(page.getByRole('region', {name: /across/i}))
      .or(page.getByText(/across/i))
      .first();
    this.downClues = page
      .locator('[data-testid="down-clues"]')
      .or(page.getByRole('region', {name: /down/i}))
      .or(page.getByText(/down/i))
      .first();
    this.checkButton = page
      .getByRole('button', {name: /check/i})
      .or(page.locator('[data-testid="check-button"]'))
      .or(page.locator('button:has-text("Check")'))
      .first();
    this.revealButton = page
      .getByRole('button', {name: /reveal/i})
      .or(page.locator('[data-testid="reveal-button"]'))
      .or(page.locator('button:has-text("Reveal")'))
      .first();
    this.resetButton = page
      .getByRole('button', {name: /reset/i})
      .or(page.locator('[data-testid="reset-button"]'))
      .or(page.locator('button:has-text("Reset")'))
      .first();
    this.timer = page
      .locator('[data-testid="timer"]')
      .or(page.locator('.timer'))
      .or(page.getByText(/\d+:\d+/))
      .first();
  }

  /**
   * Navigate to a game page by game ID
   */
  async goto(gameId: string): Promise<void> {
    await this.page.goto(`/game/${gameId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the game to be fully loaded
   * Returns true if loaded successfully, false if timeout
   */
  async waitForGameLoaded(): Promise<boolean> {
    try {
      // Wait for grid to be visible - this uses auto-waiting
      await this.grid.waitFor({state: 'visible', timeout: 10000});
      return true;
    } catch {
      // If grid doesn't appear, the game might not have loaded
      return false;
    }
  }

  /**
   * Get a cell by row and column, or by test ID
   */
  getCell(row: number, col: number): Locator;
  getCell(testId: string): Locator;
  getCell(rowOrTestId: number | string, col?: number): Locator {
    if (typeof rowOrTestId === 'string') {
      return this.page
        .locator(`[data-testid="cell-${rowOrTestId}"]`)
        .or(this.page.locator(`[data-testid^="cell-${rowOrTestId}"]`));
    }
    return this.page
      .locator(`[data-testid="cell-${rowOrTestId}-${col}"]`)
      .or(this.grid.locator(`tr:nth-child(${rowOrTestId + 1}) td:nth-child(${col! + 1})`));
  }

  /**
   * Click on a cell and type a letter
   */
  async fillCell(row: number, col: number, letter: string): Promise<void> {
    const cell = this.getCell(row, col);
    await cell.click();
    await this.page.keyboard.type(letter);
  }

  /**
   * Navigate to a cell using arrow keys
   */
  async navigateCell(direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): Promise<void> {
    await this.page.keyboard.press(direction);
  }

  /**
   * Check if a cell is selected
   */
  async isCellSelected(row: number, col: number): Promise<boolean> {
    const cell = this.getCell(row, col);
    const classes = await cell.getAttribute('class');
    return classes?.includes('selected') || (await cell.getAttribute('data-selected')) === 'true';
  }

  /**
   * Click the check button
   */
  async check(): Promise<void> {
    await this.checkButton.click();
  }

  /**
   * Click the reveal button
   */
  async reveal(): Promise<void> {
    await this.revealButton.click();
  }

  /**
   * Click the reset button
   */
  async reset(): Promise<void> {
    await this.resetButton.click();
  }

  /**
   * Get the current timer value
   */
  async getTimerValue(): Promise<string | null> {
    if (await this.timer.isVisible({timeout: 2000}).catch(() => false)) {
      return await this.timer.textContent();
    }
    return null;
  }

  /**
   * Get the current clue text
   */
  async getCurrentClue(): Promise<string | null> {
    const currentClue = this.page
      .locator('[data-testid="current-clue"]')
      .or(this.page.locator('.clue.active').or(this.page.locator('.clue.selected')));
    if (await currentClue.isVisible({timeout: 2000}).catch(() => false)) {
      return await currentClue.textContent();
    }
    return null;
  }
}
