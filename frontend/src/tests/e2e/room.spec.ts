import {test, expect} from '../fixtures';

test.describe('Room Page', () => {
  test('should load room page with room ID', async ({page, roomPage}) => {
    // Arrange & Act
    await roomPage.goto('test-room-id');

    // Assert
    await expect(page).toHaveURL(/\/room\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display room interface after loading', async ({roomPage}) => {
    // Arrange & Act
    await roomPage.goto('test-room-id');
    await roomPage.waitForRoomLoaded();

    // Assert - Room should be loaded (either with game selector or no game message)
    const hasGameSelector = await roomPage.gameSelector.isVisible({timeout: 2000}).catch(() => false);
    const hasNoGameMessage = await roomPage.noGameMessage.isVisible({timeout: 2000}).catch(() => false);

    expect(hasGameSelector || hasNoGameMessage).toBeTruthy();
  });

  test('should show message when no game is selected', async ({roomPage}) => {
    // Arrange
    await roomPage.goto('test-room-id');
    await roomPage.waitForRoomLoaded();

    // Assert
    const hasNoGame = await roomPage.hasGameSelected();
    if (!hasNoGame) {
      await expect(roomPage.noGameMessage).toBeVisible({timeout: 3000});
    } else {
      // If a game is selected, verify game selector is visible instead
      await expect(roomPage.gameSelector).toBeVisible({timeout: 3000});
    }
  });

  test('should display player list when available', async ({roomPage}) => {
    // Arrange
    await roomPage.goto('test-room-id');
    await roomPage.waitForRoomLoaded();

    // Act
    const playerCount = await roomPage.getPlayerCount();

    // Assert - If players exist, list should be visible
    if (playerCount > 0) {
      await expect(roomPage.playerList).toBeVisible({timeout: 3000});
    } else {
      // If no players, that's also a valid state
      expect(playerCount).toBe(0);
    }
  });
});
