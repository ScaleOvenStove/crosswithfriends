/**
 * E2E test fixtures
 */
import {test as base} from '@playwright/test';

import {GamePage} from './e2e/pages/GamePage';
import {ReplayPage} from './e2e/pages/ReplayPage';
import {RoomPage} from './e2e/pages/RoomPage';
import {WelcomePage} from './e2e/pages/WelcomePage';
import {setupApiMocks} from './mocks/apiHandlers';
import {createMockSocket} from './mocks/socket';
import type {MockSocket} from './mocks/socket';

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
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(welcomePage);
  },

  gamePage: async ({page}, use) => {
    const gamePage = new GamePage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(gamePage);
  },

  roomPage: async ({page}, use) => {
    const roomPage = new RoomPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(roomPage);
  },

  replayPage: async ({page}, use) => {
    const replayPage = new ReplayPage(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(replayPage);
  },
});

export {expect} from '@playwright/test';
