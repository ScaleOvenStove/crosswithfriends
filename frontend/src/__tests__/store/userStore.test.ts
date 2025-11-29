import {getAuth, onAuthStateChanged, signInWithPopup, FacebookAuthProvider} from 'firebase/auth';
import {ref, get, set, runTransaction} from 'firebase/database';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useUserStore, getUser} from '../../store/userStore';
import {mockFirebaseAuth} from '../mocks/firebase';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  FacebookAuthProvider: vi.fn(),
}));

// Mock Firebase Database
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  runTransaction: vi.fn(),
}));

// Mock firebase store
vi.mock('../../store/firebase', () => ({
  default: {},
  app: {},
  db: {},
  SERVER_TIME: {'.sv': 'timestamp'},
  getTime: vi.fn(() => ({'.sv': 'timestamp'})),
}));

// Mock localAuth
vi.mock('../../localAuth', () => ({
  default: vi.fn(() => 'local-user-id'),
}));

describe('userStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state and detach any existing subscriptions
    useUserStore.getState().detach();
    vi.mocked(getAuth).mockReturnValue(mockFirebaseAuth);
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      // Return unsubscribe function
      Promise.resolve().then(() => callback({uid: 'test-user'}));
      return () => {};
    });
    vi.mocked(FacebookAuthProvider).mockClear();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useUserStore.getState();
      expect(state.attached).toBe(false);
      expect(state.fb).toBeNull();
      expect(state.id).toBeNull();
      expect(state.color).toBeDefined();
    });
  });

  describe('attach', () => {
    it('should set up auth state listener', () => {
      const unsubscribe = vi.fn();
      vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);

      useUserStore.getState().attach();

      expect(onAuthStateChanged).toHaveBeenCalled();
    });

    it('should not set up multiple listeners', () => {
      const unsubscribe = vi.fn();
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, _callback) => {
        // Store unsubscribe in closure
        return unsubscribe;
      });

      useUserStore.getState().attach();
      const firstCallCount = vi.mocked(onAuthStateChanged).mock.calls.length;

      // Second attach should not call onAuthStateChanged again
      useUserStore.getState().attach();
      const secondCallCount = vi.mocked(onAuthStateChanged).mock.calls.length;

      // Should only be called once
      expect(firstCallCount).toBe(1);
      expect(secondCallCount).toBe(1);
    });

    it('should update state when auth state changes', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
        // Call the callback with a test user to simulate auth state change
        Promise.resolve().then(() => callback({uid: 'test-user-id'}));
        return () => {};
      });

      useUserStore.getState().attach();

      // Wait for state update - use a longer timeout to ensure async callback completes
      await new Promise((resolve) => setTimeout(resolve, 50));

      const state = useUserStore.getState();
      expect(state.attached).toBe(true);
      expect(state.fb).toEqual({uid: 'test-user-id'});
    });
  });

  describe('logIn', () => {
    it('should call signInWithPopup', async () => {
      vi.mocked(signInWithPopup).mockResolvedValue({
        user: {uid: 'test-uid'},
      });

      await useUserStore.getState().logIn();

      expect(FacebookAuthProvider).toHaveBeenCalled();
      expect(signInWithPopup).toHaveBeenCalled();
    });
  });

  describe('listUserHistory', () => {
    it('should return user history when id exists', async () => {
      const mockHistory = {
        'game-1': {pid: 123, solved: true},
        'game-2': {pid: 456, solved: false},
      };
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/history'});
      vi.mocked(get).mockResolvedValue({val: () => mockHistory});

      useUserStore.setState({id: 'test-id', attached: true});

      const history = await useUserStore.getState().listUserHistory();

      expect(history).toEqual(mockHistory);
      expect(ref).toHaveBeenCalledWith({}, 'user/test-id/history');
    });

    it('should return null when id does not exist', async () => {
      useUserStore.setState({id: null, attached: false});

      const history = await useUserStore.getState().listUserHistory();

      expect(history).toBeNull();
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('listCompositions', () => {
    it('should return user compositions when id exists', async () => {
      const mockCompositions = {
        'comp-1': {title: 'Comp 1', author: 'Author 1'},
        'comp-2': {title: 'Comp 2', author: 'Author 2'},
      };
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/compositions'});
      vi.mocked(get).mockResolvedValue({val: () => mockCompositions});

      useUserStore.setState({id: 'test-id', attached: true});

      const compositions = await useUserStore.getState().listCompositions();

      expect(compositions).toEqual(mockCompositions);
    });

    it('should return null when id does not exist', async () => {
      useUserStore.setState({id: null, attached: false});

      const compositions = await useUserStore.getState().listCompositions();

      expect(compositions).toBeNull();
    });
  });

  describe('joinComposition', () => {
    it('should add composition to user when id exists', async () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/compositions/comp-1'});
      vi.mocked(set).mockResolvedValue(undefined);

      useUserStore.setState({id: 'test-id', attached: true});

      await useUserStore.getState().joinComposition('comp-1', {
        title: 'Test Comp',
        author: 'Test Author',
        published: true,
      });

      expect(set).toHaveBeenCalled();
    });

    it('should not add composition when id does not exist', async () => {
      useUserStore.setState({id: null, attached: false});

      await useUserStore.getState().joinComposition('comp-1', {
        title: 'Test Comp',
        author: 'Test Author',
      });

      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('joinGame', () => {
    it('should add game to user history when id exists', async () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/history/game-1'});
      vi.mocked(set).mockResolvedValue(undefined);

      useUserStore.setState({id: 'test-id', attached: true});

      await useUserStore.getState().joinGame('game-1', {pid: 123, solved: false, v2: true});

      expect(set).toHaveBeenCalled();
    });

    it('should not add game when id does not exist', async () => {
      useUserStore.setState({id: null, attached: false});

      await useUserStore.getState().joinGame('game-1');

      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('markSolved', () => {
    it('should mark game as solved when id exists', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/history/game-1'});
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        callback({solved: false, pid: 123});
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});

      useUserStore.getState().markSolved('game-1');

      expect(runTransaction).toHaveBeenCalled();
    });

    it('should not mark game as solved when id does not exist', () => {
      useUserStore.setState({id: null, attached: false});

      useUserStore.getState().markSolved('game-1');

      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('should handle null item in transaction by returning null', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/history/game-1'});
      let transactionCallback: ((item: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        transactionCallback = callback;
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});
      useUserStore.getState().markSolved('game-1');

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        // Test that null item returns null
        const result = transactionCallback(null);
        expect(result).toBeNull();
      }
    });

    it('should preserve existing properties when marking as solved', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/history/game-1'});
      let transactionCallback: ((item: unknown) => unknown) | null = null;
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        transactionCallback = callback;
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});
      useUserStore.getState().markSolved('game-1');

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        const existingItem = {pid: 123, solved: false, time: 1000, v2: true};
        const result = transactionCallback(existingItem) as {
          solved: boolean;
          pid: number;
          time: number;
          v2: boolean;
        };
        expect(result.solved).toBe(true);
        expect(result.pid).toBe(123);
        expect(result.time).toBe(1000);
        expect(result.v2).toBe(true);
      }
    });
  });

  describe('recordUsername', () => {
    it('should record username when id exists', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/names/username'});
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        callback(0);
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});

      useUserStore.getState().recordUsername('testuser');

      expect(runTransaction).toHaveBeenCalled();
    });

    it('should not record username when id does not exist', () => {
      useUserStore.setState({id: null, attached: false});

      useUserStore.getState().recordUsername('testuser');

      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('should increment count from 0 when username does not exist', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/names/username'});
      let transactionCallback: ((count: number) => number) | null = null;
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        transactionCallback = callback;
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});
      useUserStore.getState().recordUsername('testuser');

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        // Test default parameter (count = 0)
        const result = transactionCallback(0);
        expect(result).toBe(1);
      }
    });

    it('should increment existing count when username already exists', () => {
      vi.mocked(ref).mockReturnValue({path: '/user/test-id/names/username'});
      let transactionCallback: ((count: number) => number) | null = null;
      vi.mocked(runTransaction).mockImplementation((_ref, callback) => {
        transactionCallback = callback;
        return Promise.resolve({});
      });

      useUserStore.setState({id: 'test-id', attached: true});
      useUserStore.getState().recordUsername('testuser');

      expect(transactionCallback).toBeDefined();
      if (transactionCallback) {
        // Test incrementing existing count
        const result = transactionCallback(5);
        expect(result).toBe(6);
      }
    });
  });

  describe('getUser', () => {
    it('should return null when not attached', () => {
      useUserStore.setState({attached: false, fb: null, id: null});
      expect(getUser()).toBeNull();
    });

    it('should return local ID when disableFbLogin is true and attached', () => {
      useUserStore.setState({attached: true, fb: null, id: 'local-user-id'});
      // getUser uses getLocalId() which is mocked to return 'local-user-id'
      expect(getUser()).toBe('local-user-id');
    });

    // Note: Firebase login is disabled (disableFbLogin = true in userStore.ts)
    // so getUser() always returns local ID when attached, never Firebase UID

    it('should return local ID when attached but no fb user', () => {
      useUserStore.setState({attached: true, fb: null, id: 'local-user-id'});
      expect(getUser()).toBe('local-user-id');
    });
  });
});
