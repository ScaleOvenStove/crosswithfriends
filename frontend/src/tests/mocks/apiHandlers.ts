/**
 * Mock API handlers for Playwright route interception
 */
import type {Route} from '@playwright/test';

import {
  mockGameData,
  mockPuzzleData,
  mockBattleData,
  mockRoomData,
  mockReplayData,
  mockPuzzleList,
} from './gameData';

/**
 * Handler for game data requests
 */
export async function handleGameRequest(route: Route, url: URL): Promise<void> {
  const gid = url.pathname.split('/').pop();

  if (gid === 'test-game-id' || gid?.startsWith('test-game-id')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockGameData),
    });
  } else if (gid === 'invalid-nonexistent-game-id-12345') {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({error: 'Game not found'}),
    });
  } else {
    await route.continue();
  }
}

/**
 * Handler for puzzle data requests
 */
export async function handlePuzzleRequest(route: Route, url: URL): Promise<void> {
  const pid = url.pathname.split('/').pop();

  if (pid === 'test-puzzle-id' || pid?.startsWith('test-puzzle-id')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPuzzleData),
    });
  } else {
    await route.continue();
  }
}

/**
 * Handler for battle data requests
 */
export async function handleBattleRequest(route: Route, url: URL): Promise<void> {
  const bid = url.pathname.split('/').pop();

  if (bid === 'test-battle-id' || bid?.startsWith('test-battle-id')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBattleData),
    });
  } else {
    await route.continue();
  }
}

/**
 * Handler for room data requests
 */
export async function handleRoomRequest(route: Route, url: URL): Promise<void> {
  const rid = url.pathname.split('/').pop();

  if (rid === 'test-room-id' || rid?.startsWith('test-room-id')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockRoomData),
    });
  } else {
    await route.continue();
  }
}

/**
 * Handler for replay data requests
 */
export async function handleReplayRequest(route: Route, url: URL): Promise<void> {
  const gid = url.pathname.split('/').pop();

  if (gid === 'test-game-id' || gid?.startsWith('test-game-id')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockReplayData),
    });
  } else {
    await route.continue();
  }
}

/**
 * Handler for puzzle list requests
 */
export async function handlePuzzleListRequest(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockPuzzleList),
  });
}

/**
 * Set up all API route handlers for a page
 */
export async function setupApiMocks(page: any): Promise<void> {
  // Intercept game API calls
  await page.route('**/api/game/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await handleGameRequest(route, url);
  });

  // Intercept puzzle API calls
  await page.route('**/api/puzzle/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await handlePuzzleRequest(route, url);
  });

  // Intercept battle API calls
  await page.route('**/api/battle/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await handleBattleRequest(route, url);
  });

  // Intercept room API calls
  await page.route('**/api/room/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await handleRoomRequest(route, url);
  });

  // Intercept replay API calls
  await page.route('**/api/replay/**', async (route: Route) => {
    const url = new URL(route.request().url());
    await handleReplayRequest(route, url);
  });

  // Intercept puzzle list API calls
  await page.route('**/api/puzzles', handlePuzzleListRequest);
  await page.route('**/api/puzzles/**', handlePuzzleListRequest);

  // Mock Firebase Realtime Database calls
  await page.route('**/*.firebaseio.com/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // Create event structure for Firebase
    const createEvent = {
      id: 'create-event-1',
      type: 'create',
      timestamp: Date.now(),
      params: {
        game: mockGameData,
      },
    };

    // Handle game events endpoint
    if (path.includes('/games/test-game-id/events') || path.includes('/game/test-game-id/events')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([createEvent]),
      });
    }
    // Handle game data endpoint
    else if (path.includes('/games/test-game-id') || path.includes('/game/test-game-id')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockGameData),
      });
    }
    // Handle puzzle data
    else if (path.includes('/puzzles/test-puzzle-id')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPuzzleData),
      });
    }
    // Default: fulfill with empty object to prevent Firebase errors
    else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  });
}
