/**
 * E2E test fixtures
 */
import {test as base} from '@playwright/test';

import {createMockSocket} from './mocks/socket';
import type {MockSocket} from './mocks/socket';
import {setupApiMocks} from './mocks/apiHandlers';
import {GamePage} from './e2e/pages/GamePage';
import {WelcomePage} from './e2e/pages/WelcomePage';
import {RoomPage} from './e2e/pages/RoomPage';
import {ReplayPage} from './e2e/pages/ReplayPage';

type TestFixtures = {
  mockSocket: MockSocket;
  welcomePage: WelcomePage;
  gamePage: GamePage;
  roomPage: RoomPage;
  replayPage: ReplayPage;
};

export const test = base.extend<TestFixtures>({
  // Override page fixture to automatically set up API mocking
  page: async ({page}, use) => {
    // Set up API route mocking for all tests
    await setupApiMocks(page);
    await use(page);
  },

  // eslint-disable-next-line no-empty-pattern
  mockSocket: async ({}, use) => {
    const socket = createMockSocket();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(socket);
  },

  welcomePage: async ({page}, use) => {
    const welcomePage = new WelcomePage(page);
    await use(welcomePage);
  },

  gamePage: async ({page}, use) => {
    const gamePage = new GamePage(page);
    await use(gamePage);
  },

  roomPage: async ({page}, use) => {
    const roomPage = new RoomPage(page);
    await use(roomPage);
  },

  replayPage: async ({page}, use) => {
    const replayPage = new ReplayPage(page);
    await use(replayPage);
  },
});

export {expect} from '@playwright/test';
