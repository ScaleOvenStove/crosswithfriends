/**
 * E2E test fixtures
 */
import {test as base} from '@playwright/test';

import {createMockSocket} from './mocks/socket';
import type {MockSocket} from './mocks/socket';

type TestFixtures = {
  mockSocket: MockSocket;
};

export const test = base.extend<TestFixtures>({
  // eslint-disable-next-line no-empty-pattern
  mockSocket: async ({}, use) => {
    const socket = createMockSocket();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(socket);
  },
});

export {expect} from '@playwright/test';
