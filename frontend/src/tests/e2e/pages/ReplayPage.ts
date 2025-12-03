import type {Page, Locator} from '@playwright/test';

/**
 * Page Object Model for the Replay page
 * Encapsulates interactions with the game replay interface
 */
export class ReplayPage {
  readonly page: Page;
  readonly player: Locator;
  readonly playButton: Locator;
  readonly pauseButton: Locator;
  readonly timeline: Locator;
  readonly grid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.player = page.locator('[data-testid="replay-player"]').or(page.locator('.replay-player'));
    this.playButton = page
      .getByRole('button', {name: /play/i})
      .or(page.locator('[data-testid="play-button"]'));
    this.pauseButton = page
      .getByRole('button', {name: /pause/i})
      .or(page.locator('[data-testid="pause-button"]'));
    this.timeline = page.locator('[data-testid="timeline"]').or(page.locator('.timeline'));
    this.grid = page
      .locator('[data-testid="crossword-grid"]')
      .or(page.locator('.grid'))
      .or(page.locator('.crossword-grid'))
      .first();
  }

  /**
   * Navigate to a replay page by game ID
   */
  async goto(gameId: string): Promise<void> {
    await this.page.goto(`/replay/${gameId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the replay to be loaded
   * Returns true if loaded successfully, false if timeout
   */
  async waitForReplayLoaded(): Promise<boolean> {
    try {
      await this.grid.waitFor({state: 'visible', timeout: 10000});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Play the replay
   */
  async play(): Promise<void> {
    if (await this.playButton.isVisible({timeout: 2000}).catch(() => false)) {
      await this.playButton.click();
    }
  }

  /**
   * Pause the replay
   */
  async pause(): Promise<void> {
    if (await this.pauseButton.isVisible({timeout: 2000}).catch(() => false)) {
      await this.pauseButton.click();
    }
  }

  /**
   * Check if replay is playing
   */
  async isPlaying(): Promise<boolean> {
    return await this.pauseButton.isVisible({timeout: 1000}).catch(() => false);
  }
}

