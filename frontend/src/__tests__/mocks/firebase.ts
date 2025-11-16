/**
 * Mock implementations for Firebase for Vitest tests
 */
import {vi} from 'vitest';

export const mockFirebaseApp = {
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
};

export const mockFirebaseAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((_callback: (user: any) => void) => {
    // Return unsubscribe function
    return () => {};
  }),
  signInWithPopup: vi.fn(async () => {
    return {
      user: {
        uid: 'test-user-id',
        displayName: 'Test User',
        email: 'test@example.com',
      },
    };
  }),
  signOut: vi.fn(async () => {}),
};

export const mockFirebaseDatabase = {
  ref: vi.fn((path: string) => ({
    path,
    key: path.split('/').pop(),
  })),
  get: vi.fn(async (_ref: any) => ({
    val: () => null,
    exists: () => false,
  })),
  set: vi.fn(async () => {}),
  runTransaction: vi.fn(async () => ({})),
  onValue: vi.fn((_ref: any, _callback: (snapshot: any) => void) => {
    // Return unsubscribe function
    return () => {};
  }),
  off: vi.fn(() => {}),
  serverTimestamp: vi.fn(() => ({
    '.sv': 'timestamp',
  })),
};

export const mockGetAuth = vi.fn(() => mockFirebaseAuth);
export const mockGetDatabase = vi.fn(() => mockFirebaseDatabase);
export const mockRef = mockFirebaseDatabase.ref;
export const mockGet = mockFirebaseDatabase.get;
export const mockSet = mockFirebaseDatabase.set;
export const mockRunTransaction = mockFirebaseDatabase.runTransaction;
export const mockOnValue = mockFirebaseDatabase.onValue;
export const mockOff = mockFirebaseDatabase.off;
export const mockServerTimestamp = mockFirebaseDatabase.serverTimestamp;
