/**
 * Firebase Emulator utilities for E2E tests
 *
 * This module provides utilities to connect to the Firebase Realtime Database
 * emulator during E2E tests and set up test data.
 */

import {initializeApp, getApps, type FirebaseApp} from 'firebase/app';
import {getDatabase, ref, set, get, type Database} from 'firebase/database';

// eslint-disable-next-line no-undef
const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || 'localhost:9000';
const PROJECT_ID = 'test-project';

/**
 * Initialize Firebase app connected to the emulator
 */
export function initializeFirebaseEmulator(): FirebaseApp {
  // Delete existing apps to avoid conflicts
  getApps().forEach((app) => app.delete());

  const app = initializeApp({
    projectId: PROJECT_ID,
    databaseURL: `http://${EMULATOR_HOST}?ns=${PROJECT_ID}`,
  });

  return app;
}

/**
 * Get a database instance connected to the emulator
 */
export function getEmulatorDatabase(): Database {
  const app = initializeFirebaseEmulator();
  return getDatabase(app);
}

/**
 * Set up test data in the emulator
 */
export async function setupTestData(data: Record<string, any>): Promise<void> {
  const db = getEmulatorDatabase();

  for (const [path, value] of Object.entries(data)) {
    await set(ref(db, path), value);
  }
}

/**
 * Get test data from the emulator
 */
export async function getTestData(path: string): Promise<any> {
  const db = getEmulatorDatabase();
  const snapshot = await get(ref(db, path));
  return snapshot.val();
}

/**
 * Clear all data from the emulator
 * Note: This requires the emulator to support clearing, or you can manually clear paths
 */
export async function clearEmulatorData(paths: string[] = []): Promise<void> {
  const db = getEmulatorDatabase();

  if (paths.length === 0) {
    // Clear common paths
    paths = [
      'game',
      'puzzle',
      'puzzlelist',
      'stats',
      'user',
      'battle',
      'counters',
      'cursors',
      'history',
      'composition',
      'myCompositions',
    ];
  }

  for (const path of paths) {
    try {
      await set(ref(db, path), null);
    } catch (_error) {
      // Ignore errors if path doesn't exist
      console.warn(`Failed to clear path ${path}:`, _error);
    }
  }
}

/**
 * Wait for Firebase connection to be ready
 */
export async function waitForFirebaseConnection(db: Database, timeout = 5000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const testRef = ref(db, '.info/connected');
      const snapshot = await get(testRef);
      if (snapshot.val() === true) {
        return;
      }
    } catch (_error) {
      // Connection not ready yet, continue waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Firebase connection timeout');
}
