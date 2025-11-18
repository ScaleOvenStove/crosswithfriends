/**
 * Mock implementations for Firebase
 */

export const mockFirebaseApp = {
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
};

export const mockFirebaseAuth = {
  currentUser: null,
  onAuthStateChanged: (_callback: (user: any) => void) => {
    // Return unsubscribe function
    return () => {};
  },
  signInWithPopup: async () => {
    return {
      user: {
        uid: 'test-user-id',
        displayName: 'Test User',
        email: 'test@example.com',
      },
    };
  },
};

export const mockFirebaseDatabase = {
  ref: (path: string) => ({
    path,
    key: path.split('/').pop(),
  }),
  get: async (_ref: any) => ({
    val: () => null,
    exists: () => false,
  }),
  set: async () => {},
  runTransaction: async () => ({}),
  onValue: (_ref: any, _callback: (snapshot: any) => void) => {
    // Return unsubscribe function
    return () => {};
  },
  off: () => {},
  serverTimestamp: () => ({
    '.sv': 'timestamp',
  }),
};

export const mockGetAuth = () => mockFirebaseAuth;
export const mockGetDatabase = () => mockFirebaseDatabase;
export const mockRef = mockFirebaseDatabase.ref;
export const mockGet = mockFirebaseDatabase.get;
export const mockSet = mockFirebaseDatabase.set;
export const mockRunTransaction = mockFirebaseDatabase.runTransaction;
export const mockOnValue = mockFirebaseDatabase.onValue;
export const mockOff = mockFirebaseDatabase.off;
export const mockServerTimestamp = mockFirebaseDatabase.serverTimestamp;
