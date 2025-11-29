import type {Page, Locator} from '@playwright/test';

/**
 * Page Object Model for the Welcome page
 * Encapsulates all interactions and selectors for the welcome/home page
 */
export class WelcomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly puzzleList: Locator;
  readonly filterCheckboxes: Locator;

  constructor(page: Page) {
    this.page = page;
    // Use role-based locators where possible, fallback to test IDs
    this.searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox')).or(page.locator('[data-testid="search-input"]'));
    this.puzzleList = page.locator('[data-testid="puzzle-list"]').or(page.getByRole('list', {name: /puzzle/i}));
    this.filterCheckboxes = page.getByRole('checkbox');
  }

  /**
   * Navigate to the welcome page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for the page to be ready - use auto-waiting instead of networkidle
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Search for puzzles by text
   */
  async search(query: string): Promise<void> {
    if (await this.searchInput.isVisible({timeout: 2000}).catch(() => false)) {
      await this.searchInput.fill(query);
      await this.searchInput.press('Enter');
    }
  }

  /**
   * Toggle a filter checkbox by label text
   */
  async toggleFilter(filterLabel: string): Promise<void> {
    const filter = this.page.getByLabel(filterLabel, {exact: false});
    if (await filter.isVisible({timeout: 2000}).catch(() => false)) {
      await filter.click();
    }
  }

  /**
   * Get the count of visible puzzles
   */
  async getPuzzleCount(): Promise<number> {
    const listItems = this.puzzleList.locator('li').or(this.page.getByRole('listitem'));
    return await listItems.count();
  }

  /**
   * Click on a puzzle by its title or index
   */
  async clickPuzzle(titleOrIndex: string | number): Promise<void> {
    if (typeof titleOrIndex === 'string') {
      const puzzle = this.page.getByRole('link', {name: new RegExp(titleOrIndex, 'i')});
      await puzzle.click();
    } else {
      const puzzles = this.puzzleList.locator('li').or(this.page.getByRole('listitem'));
      await puzzles.nth(titleOrIndex).click();
    }
  }
}




