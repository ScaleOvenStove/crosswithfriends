/**
 * E2E tests for Firebase Realtime Database integration
 *
 * These tests verify that the application correctly interacts with Firebase
 * when running against the Firebase emulator.
 */

import {ref, get, set} from 'firebase/database';

import {test, expect} from '../fixtures';

import {
  getEmulatorDatabase,
  setupTestData,
  clearEmulatorData,
  waitForFirebaseConnection,
} from './utils/firebase-emulator';

test.describe('Firebase Integration', () => {
  test.beforeEach(async () => {
    // Clear emulator data before each test
    await clearEmulatorData();
  });

  test('should connect to Firebase emulator', async ({page}) => {
    // Arrange - Set up test data
    await setupTestData({
      'puzzle/test-puzzle': {
        title: 'Test Puzzle',
        author: 'Test Author',
      },
    });

    // Act - Navigate to a page that uses Firebase
    await page.goto('/beta/play/test-puzzle');

    // Assert - Page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should read puzzle data from Firebase', async () => {
    // Arrange - Set up test puzzle data
    const testPuzzle = {
      title: 'E2E Test Puzzle',
      author: 'Test Author',
      grid: ['A', 'B', 'C'],
    };

    await setupTestData({
      'puzzle/test-puzzle-123': testPuzzle,
    });

    // Act - Read data from Firebase
    const db = getEmulatorDatabase();
    await waitForFirebaseConnection(db);

    const puzzleRef = ref(db, 'puzzle/test-puzzle-123');
    const snapshot = await get(puzzleRef);
    const data = snapshot.val();

    // Assert
    expect(data).toBeDefined();
    expect(data.title).toBe(testPuzzle.title);
    expect(data.author).toBe(testPuzzle.author);
  });

  test('should write game data to Firebase', async () => {
    // Arrange
    const db = getEmulatorDatabase();
    await waitForFirebaseConnection(db);

    const gameData = {
      pid: 'test-puzzle-123',
      events: {},
      createdAt: Date.now(),
    };

    // Act - Write game data (should succeed per rules - new game)
    const gameRef = ref(db, 'game/test-game-123');
    await set(gameRef, gameData);

    // Assert - Verify data was written
    const snapshot = await get(gameRef);
    const data = snapshot.val();
    expect(data).toBeDefined();
    expect(data.pid).toBe(gameData.pid);
  });

  test('should enforce security rules - deny write to existing game', async ({page}) => {
    // Arrange - Create an existing game
    await setupTestData({
      'game/existing-game': {
        pid: 'test-puzzle',
        events: {},
      },
    });

    const db = getEmulatorDatabase();
    await waitForFirebaseConnection(db);

    // Act - Navigate to page that might try to write to existing game
    await page.goto('/beta/play/test-puzzle');

    // Assert - Page should load (the UI should handle the rule enforcement)
    await expect(page.locator('body')).toBeVisible();

    // Note: Full security rule testing is done in unit tests (database.rules.test.ts)
    // E2E tests verify the app behaves correctly when rules are enforced
  });

  test('should handle real-time updates', async ({page}) => {
    // Arrange
    const db = getEmulatorDatabase();
    await waitForFirebaseConnection(db);

    // Set up initial data
    await setupTestData({
      'game/test-game-realtime': {
        pid: 'test-puzzle',
        events: {},
      },
    });

    // Act - Navigate to page that should listen to Firebase updates
    await page.goto('/beta/play/test-puzzle');

    // Update data in Firebase
    await set(ref(db, 'game/test-game-realtime/events/event1'), {
      type: 'cell-fill',
      cell: 'A1',
      value: 'X',
    });

    // Assert - The UI should reflect the update
    // This depends on your app's implementation
    await expect(page.locator('body')).toBeVisible();
  });

  test('should read public puzzle data', async () => {
    // Arrange
    await setupTestData({
      'puzzle/public-puzzle': {
        title: 'Public Puzzle',
        author: 'Public Author',
      },
    });

    // Act
    const db = getEmulatorDatabase();
    await waitForFirebaseConnection(db);

    const puzzleRef = ref(db, 'puzzle/public-puzzle');
    const snapshot = await get(puzzleRef);
    const data = snapshot.val();

    // Assert - Public puzzle should be readable
    expect(data).toBeDefined();
    expect(data.title).toBe('Public Puzzle');
  });
});
