import {getAuth, onAuthStateChanged, signInWithPopup, FacebookAuthProvider} from 'firebase/auth';
import {ref, get, set, runTransaction} from 'firebase/database';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {useUserStore} from '../../store/userStore';
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
    (getAuth as any).mockReturnValue(mockFirebaseAuth);
    (onAuthStateChanged as any).mockImplementation((_auth, callback) => {
      // Return unsubscribe function
      Promise.resolve().then(() => callback({uid: 'test-user'}));
      return () => {};
    });
    (FacebookAuthProvider as any).mockClear();
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
      (onAuthStateChanged as any).mockReturnValue(unsubscribe);

      useUserStore.getState().attach();

      expect(onAuthStateChanged).toHaveBeenCalled();
    });

    it('should not set up multiple listeners', () => {
      const unsubscribe = vi.fn();
      (onAuthStateChanged as any).mockImplementation((_auth, _callback) => {
        // Store unsubscribe in closure
        return unsubscribe;
      });

      useUserStore.getState().attach();
      const firstCallCount = (onAuthStateChanged as any).mock.calls.length;

      // Second attach should not call onAuthStateChanged again
      useUserStore.getState().attach();
      const secondCallCount = (onAuthStateChanged as any).mock.calls.length;

      // Should only be called once
      expect(firstCallCount).toBe(1);
      expect(secondCallCount).toBe(1);
    });

    it('should update state when auth state changes', async () => {
      (onAuthStateChanged as any).mockImplementation((_auth, callback) => {
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
      (signInWithPopup as any).mockResolvedValue({
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
      (ref as any).mockReturnValue({path: '/user/test-id/history'});
      (get as any).mockResolvedValue({val: () => mockHistory});

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
      (ref as any).mockReturnValue({path: '/user/test-id/compositions'});
      (get as any).mockResolvedValue({val: () => mockCompositions});

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
      (ref as any).mockReturnValue({path: '/user/test-id/compositions/comp-1'});
      (set as any).mockResolvedValue(undefined);

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
      (ref as any).mockReturnValue({path: '/user/test-id/history/game-1'});
      (set as any).mockResolvedValue(undefined);

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
      (ref as any).mockReturnValue({path: '/user/test-id/history/game-1'});
      (runTransaction as any).mockImplementation((_ref, callback) => {
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
  });

  describe('recordUsername', () => {
    it('should record username when id exists', () => {
      (ref as any).mockReturnValue({path: '/user/test-id/names/username'});
      (runTransaction as any).mockImplementation((_ref, callback) => {
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
  });
});
