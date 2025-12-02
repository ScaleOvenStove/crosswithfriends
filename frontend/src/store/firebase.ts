import {initializeApp, getApps, type FirebaseApp} from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  off,
  serverTimestamp,
  onDisconnect,
  type Database,
  type DatabaseReference,
  type OnDisconnect,
} from 'firebase/database';

import {firebaseConfig} from '../config';

const offline = firebaseConfig.offline;
const config = firebaseConfig.config;

// Initialize Firebase app if not already initialized
let app: FirebaseApp | undefined;
if (getApps().length === 0) {
  app = initializeApp(config);
} else {
  app = getApps()[0];
}

if (!app) {
  throw new Error('Failed to initialize Firebase app');
}

const db = getDatabase(app);

// Note: Firebase Realtime Database automatically enables offline persistence in web browsers.
// Data is cached locally and automatically synchronized when the connection is restored.
// The 'offline' config flag can be used to control app behavior, but persistence is always enabled.

// SERVER_TIME is a Firebase sentinel value that becomes a timestamp when written to the database
// TypeScript sees it as 'object' but it will be a number in the database
const SERVER_TIME = serverTimestamp() as unknown as number;

// Get server time offset - use onValue for better connection handling
// This will wait for the connection to be established before reading
let offset = 0;
let offsetListener: (() => void) | null = null;

try {
  const offsetRef = ref(db, '.info/serverTimeOffset');
  // Use onValue instead of get for better connection handling
  // It will wait for connection and handle errors more gracefully
  offsetListener = onValue(offsetRef, (snapshot) => {
    try {
      const val = snapshot.val();
      if (val !== null && val !== undefined && typeof val === 'number') {
        offset = val;
      }
    } catch {
      // Silently handle error - server time offset is not critical
      offset = 0;
    }
    // Unsubscribe after first successful read
    if (offsetListener) {
      off(offsetRef, 'value', offsetListener);
      offsetListener = null;
    }
  });
} catch {
  // Handle initialization error gracefully - server time offset is not critical
  // Using local time is acceptable fallback
  offset = 0;
}

function getTime(): number {
  return new Date().getTime() + offset;
}

/**
 * Monitor Firebase Realtime Database connection state
 * @param callback Function called when connection state changes (true = connected, false = disconnected)
 * @returns Unsubscribe function
 */
function onConnectionStateChange(callback: (connected: boolean) => void): () => void {
  const connectedRef = ref(db, '.info/connected');
  return onValue(connectedRef, (snapshot) => {
    callback(snapshot.val() === true);
  });
}

/**
 * Get the current connection state synchronously
 * Note: This requires a listener to be set up first. Use onConnectionStateChange for reliable state.
 * @returns Promise that resolves to true if connected, false otherwise
 */
async function getConnectionState(): Promise<boolean> {
  return new Promise((resolve) => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      unsubscribe();
      resolve(snapshot.val() === true);
    });
  });
}

/**
 * Set up an onDisconnect operation for a database reference
 * This is useful for presence management - operations will execute when the client disconnects
 * @param databaseRef The database reference to set up disconnect operations for
 * @returns OnDisconnect instance for chaining operations
 * @example
 * const presenceRef = ref(db, 'users/joe/online');
 * onDisconnectFor(presenceRef).set(false);
 */
function onDisconnectFor(databaseRef: DatabaseReference): OnDisconnect {
  return onDisconnect(databaseRef);
}

export {db, SERVER_TIME};
export {offline, getTime, onConnectionStateChange, getConnectionState, onDisconnectFor};
export type {Database, DatabaseReference, OnDisconnect};
export default app;
