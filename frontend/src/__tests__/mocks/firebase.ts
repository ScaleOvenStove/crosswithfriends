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
  onAuthStateChanged: vi.fn((_callback: (user: unknown) => void) => {
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
  get: vi.fn(async (_ref: unknown) => ({
    val: () => null,
    exists: () => false,
  })),
  set: vi.fn(async () => {}),
  runTransaction: vi.fn(async () => ({})),
  onValue: vi.fn((_ref: unknown, _callback: (snapshot: unknown) => void) => {
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

// Additional Firebase mocks for more complex operations
export const mockPush = vi.fn(async (_ref: unknown) => ({
  key: 'mock-key',
}));

export const mockRemove = vi.fn(async () => {});

export const mockOnChildAdded = vi.fn((_ref: unknown, _callback: (snapshot: unknown) => void) => {
  // Return unsubscribe function
  return () => {};
});

export const mockQuery = vi.fn((_ref: unknown) => ({
  path: 'mock-query',
}));

export const mockOrderByChild = vi.fn((_field: string) => ({
  path: 'mock-order',
}));

export const mockEqualTo = vi.fn((_value: unknown) => ({
  path: 'mock-equal',
}));

export const mockLimitToLast = vi.fn((_limit: number) => ({
  path: 'mock-limit',
}));
