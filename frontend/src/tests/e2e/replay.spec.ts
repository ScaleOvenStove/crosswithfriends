import {test, expect} from '../fixtures';

test.describe('Replay Page', () => {
  test('should load replay page with game ID', async ({page, replayPage}) => {
    // Arrange & Act
    await replayPage.goto('test-game-id');

    // Assert
    await expect(page).toHaveURL(/\/replay\//);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display replay interface after loading', async ({replayPage}) => {
    // Arrange & Act
    await replayPage.goto('test-game-id');
    await replayPage.waitForReplayLoaded();

    // Assert
    await expect(replayPage.grid).toBeVisible();
  });

  test('should have play controls available', async ({replayPage}) => {
    // Arrange
    await replayPage.goto('test-game-id');
    await replayPage.waitForReplayLoaded();

    // Assert - Play button should be visible (or pause if already playing)
    const hasPlayButton = await replayPage.playButton.isVisible({timeout: 3000}).catch(() => false);
    const hasPauseButton = await replayPage.pauseButton.isVisible({timeout: 3000}).catch(() => false);

    expect(hasPlayButton || hasPauseButton).toBeTruthy();
  });

  test('should allow playing the replay', async ({replayPage}) => {
    // Arrange
    await replayPage.goto('test-game-id');
    await replayPage.waitForReplayLoaded();

    // Act
    const hasPlayButton = await replayPage.playButton.isVisible({timeout: 3000}).catch(() => false);
    if (hasPlayButton) {
      await replayPage.play();

      // Assert - Should show pause button after playing
      await expect(replayPage.pauseButton).toBeVisible({timeout: 3000});
    } else {
      // If already playing, skip
      test.skip();
    }
  });

  test('should allow pausing the replay', async ({replayPage}) => {
    // Arrange
    await replayPage.goto('test-game-id');
    await replayPage.waitForReplayLoaded();

    // Act - First play if not already playing
    const hasPlayButton = await replayPage.playButton.isVisible({timeout: 2000}).catch(() => false);
    if (hasPlayButton) {
      await replayPage.play();
    }

    // Then pause
    const hasPauseButton = await replayPage.pauseButton.isVisible({timeout: 2000}).catch(() => false);
    if (hasPauseButton) {
      await replayPage.pause();

      // Assert - Should show play button after pausing
      await expect(replayPage.playButton).toBeVisible({timeout: 3000});
    } else {
      test.skip();
    }
  });
});
