import type {Page, Locator} from '@playwright/test';

/**
 * Page Object Model for the Room page
 * Encapsulates interactions with the room/multiplayer interface
 */
export class RoomPage {
  readonly page: Page;
  readonly gameSelector: Locator;
  readonly noGameMessage: Locator;
  readonly playerList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.gameSelector = page.locator('[data-testid="game-selector"]').or(page.getByRole('combobox', {name: /game/i}));
    this.noGameMessage = page.getByText(/no game/i).or(page.locator('[data-testid="no-game-message"]'));
    this.playerList = page.locator('[data-testid="player-list"]').or(page.getByRole('list', {name: /player/i}));
  }

  /**
   * Navigate to a room page by room ID
   */
  async goto(roomId: string): Promise<void> {
    await this.page.goto(`/room/${roomId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for the room to be loaded
   */
  async waitForRoomLoaded(): Promise<void> {
    // Wait for either game selector or no game message
    await Promise.race([
      this.gameSelector.waitFor({state: 'visible', timeout: 5000}).catch(() => {}),
      this.noGameMessage.waitFor({state: 'visible', timeout: 5000}).catch(() => {}),
    ]);
  }

  /**
   * Check if a game is selected
   */
  async hasGameSelected(): Promise<boolean> {
    return await this.noGameMessage.isVisible({timeout: 1000}).then(() => false).catch(() => true);
  }

  /**
   * Get the list of players in the room
   */
  async getPlayerCount(): Promise<number> {
    if (await this.playerList.isVisible({timeout: 2000}).catch(() => false)) {
      return await this.playerList.locator('li').or(this.page.getByRole('listitem')).count();
    }
    return 0;
  }
}




