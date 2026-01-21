/**
 * useFirebaseAuth Hook Tests
 * Tests authentication hook behavior and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useFirebaseAuth from '../firebase/useFirebaseAuth';

// Mock Firebase modules - use vi.hoisted to define mutable object before vi.mock (which is hoisted)
const { mockConfig } = vi.hoisted(() => {
  return {
    mockConfig: {
      auth: {
        currentUser: null,
      },
      isFirebaseConfigured: true,
    },
  };
});

vi.mock('../../firebase/config', () => mockConfig);

const mockUnsubscribe = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock('../../firebase/auth', () => ({
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInAnonymousUser: vi.fn(),
  signOutUser: vi.fn(),
  sendPasswordReset: vi.fn(),
  updateUserProfile: vi.fn(),
  changePassword: vi.fn(),
  getIdToken: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../../services/authTokenService', () => ({
  exchangeFirebaseToken: vi.fn(),
  clearBackendToken: vi.fn(),
  setBackendToken: vi.fn(),
}));

describe('useFirebaseAuth', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockUnsubscribe.mockClear();

    // Mock authTokenService
    const { exchangeFirebaseToken, clearBackendToken, setBackendToken } = await import(
      '../../services/authTokenService'
    );
    vi.mocked(exchangeFirebaseToken).mockResolvedValue({
      token: 'mock-backend-token',
      userId: 'test-uid',
      expiresAt: Date.now() + 3600000,
    });
    vi.mocked(clearBackendToken).mockReturnValue(undefined);
    vi.mocked(setBackendToken).mockReturnValue(undefined);

    // Mock signInAnonymousUser to return a user when called
    const { signInAnonymousUser } = await import('../../firebase/auth');
    vi.mocked(signInAnonymousUser).mockResolvedValue({
      user: { uid: 'anon-uid', isAnonymous: true, getIdToken: vi.fn().mockResolvedValue('anon-token') },
    } as any);

    // Reset onAuthStateChange to default implementation
    const { onAuthStateChange } = await import('../../firebase/auth');
    vi.mocked(onAuthStateChange).mockImplementation((onChange, onError) => {
      // Simulate initial auth state (null triggers anonymous sign-in)
      // Then simulate Firebase triggering auth state change with anonymous user
      onChange(null);
      // Schedule the anonymous user auth state change after sign-in
      Promise.resolve().then(() => {
        onChange({
          uid: 'anon-uid',
          isAnonymous: true,
          getIdToken: vi.fn().mockResolvedValue('anon-token'),
        } as any);
      });
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    // Restore default config values
    mockConfig.isFirebaseConfigured = true;
    mockConfig.auth = { currentUser: null };
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      // Wait for auth state to be determined (anonymous sign-in completes)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // After anonymous sign-in, user should be set
      expect(result.current.user).toBeTruthy();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should set loading to false if Firebase is not configured', () => {
      // Override the config mock for this test to simulate Firebase not configured
      const originalIsConfigured = mockConfig.isFirebaseConfigured;
      const originalAuth = mockConfig.auth;
      
      mockConfig.isFirebaseConfigured = false;
      mockConfig.auth = null;

      const { result } = renderHook(() => useFirebaseAuth());

      // When Firebase is not configured, loading should be false immediately
      expect(result.current.loading).toBe(false);
      
      // Restore the original values
      mockConfig.isFirebaseConfigured = originalIsConfigured;
      mockConfig.auth = originalAuth;
    });
  });

  describe('Auth State Changes', () => {
    it('should update user state when auth state changes', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('mock-firebase-token'),
      };
      const { onAuthStateChange } = await import('../../firebase/auth');

      vi.mocked(onAuthStateChange).mockImplementation((onChange) => {
        onChange(mockUser as any);
        return vi.fn();
      });

      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should set loading to false after auth state is determined', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('signUp', () => {
    it('should call signUpWithEmail and return user', async () => {
      const { signUpWithEmail } = await import('../../firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signUpWithEmail).mockResolvedValue({ user: mockUser } as any);

      const { result } = renderHook(() => useFirebaseAuth());

      const user = await result.current.signUp('test@example.com', 'password123', 'Test User');

      expect(signUpWithEmail).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      expect(user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should set error on sign up failure', async () => {
      const { signUpWithEmail } = await import('../../firebase/auth');
      vi.mocked(signUpWithEmail).mockRejectedValue(new Error('Sign up failed'));

      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.signUp('test@example.com', 'password123')).rejects.toThrow(
        'Sign up failed'
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Sign up failed');
      });
    });
  });

  describe('signIn', () => {
    it('should call signInWithEmail and return user', async () => {
      const { signInWithEmail } = await import('../../firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signInWithEmail).mockResolvedValue({ user: mockUser } as any);

      const { result } = renderHook(() => useFirebaseAuth());

      const user = await result.current.signIn('test@example.com', 'password123');

      expect(signInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(user).toEqual(mockUser);
    });
  });

  describe('signInWithGoogle', () => {
    it('should call signInWithGoogle and return user', async () => {
      const { signInWithGoogle } = await import('../../firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signInWithGoogle).mockResolvedValue({ user: mockUser } as any);

      const { result } = renderHook(() => useFirebaseAuth());

      const user = await result.current.signInWithGoogle();

      expect(signInWithGoogle).toHaveBeenCalled();
      expect(user).toEqual(mockUser);
    });
  });

  describe('signInAnonymously', () => {
    it('should call signInAnonymousUser and return user', async () => {
      const { signInAnonymousUser } = await import('../../firebase/auth');
      const mockUser = { uid: 'anon-uid', isAnonymous: true };
      vi.mocked(signInAnonymousUser).mockResolvedValue({ user: mockUser } as any);

      const { result } = renderHook(() => useFirebaseAuth());

      const user = await result.current.signInAnonymously();

      expect(signInAnonymousUser).toHaveBeenCalled();
      expect(user).toEqual(mockUser);
    });
  });

  describe('signOut', () => {
    it('should call signOutUser', async () => {
      const { signOutUser } = await import('../../firebase/auth');
      vi.mocked(signOutUser).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await result.current.signOut();

      expect(signOutUser).toHaveBeenCalled();
    });

    it('should set error on sign out failure', async () => {
      const { signOutUser } = await import('../../firebase/auth');
      vi.mocked(signOutUser).mockRejectedValue(new Error('Sign out failed'));

      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.signOut()).rejects.toThrow('Sign out failed');

      await waitFor(() => {
        expect(result.current.error).toBe('Sign out failed');
      });
    });
  });

  describe('resetPassword', () => {
    it('should call sendPasswordReset', async () => {
      const { sendPasswordReset } = await import('../../firebase/auth');
      vi.mocked(sendPasswordReset).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await result.current.resetPassword('test@example.com');

      expect(sendPasswordReset).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('mock-firebase-token'),
        reload: vi.fn().mockResolvedValue(undefined),
      };
      const { onAuthStateChange } = await import('../../firebase/auth');
      const { updateUserProfile } = await import('../../firebase/auth');

      vi.mocked(onAuthStateChange).mockImplementation((onChange) => {
        onChange(mockUser as any);
        return vi.fn();
      });
      vi.mocked(updateUserProfile).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      await result.current.updateProfile({ displayName: 'New Name' });

      expect(updateUserProfile).toHaveBeenCalledWith(expect.any(Object), {
        displayName: 'New Name',
      });
      expect(mockUser.reload).toHaveBeenCalled();
    });

    it('should throw error if no user is logged in', async () => {
      // Override mocks to prevent anonymous sign-in
      const { onAuthStateChange } = await import('../../firebase/auth');
      const { signInAnonymousUser } = await import('../../firebase/auth');
      
      // Mock signInAnonymousUser to reject to prevent automatic sign-in
      vi.mocked(signInAnonymousUser).mockRejectedValue(new Error('Sign in failed'));
      
      // Mock onAuthStateChange to only call onChange with null, not trigger anonymous user
      vi.mocked(onAuthStateChange).mockImplementation((onChange) => {
        // Call onChange with null - hook will try to sign in anonymously and fail
        onChange(null);
        // Don't call onChange again with a user
        return vi.fn();
      });

      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
      });

      await expect(result.current.updateProfile({ displayName: 'New Name' })).rejects.toThrow(
        'No user logged in'
      );
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        getIdToken: vi.fn().mockResolvedValue('mock-firebase-token'),
        reload: vi.fn().mockResolvedValue(undefined),
      };
      const { onAuthStateChange } = await import('../../firebase/auth');
      const { changePassword } = await import('../../firebase/auth');

      vi.mocked(onAuthStateChange).mockImplementation((onChange) => {
        onChange(mockUser as any);
        return vi.fn();
      });
      vi.mocked(changePassword).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      await result.current.changePassword('oldPassword', 'newPassword');

      expect(changePassword).toHaveBeenCalledWith(expect.any(Object), 'oldPassword', 'newPassword');
    });

    it('should throw error if no user is logged in', async () => {
      // Override mocks to prevent anonymous sign-in
      const { onAuthStateChange } = await import('../../firebase/auth');
      const { signInAnonymousUser } = await import('../../firebase/auth');
      
      // Mock signInAnonymousUser to reject to prevent automatic sign-in
      vi.mocked(signInAnonymousUser).mockRejectedValue(new Error('Sign in failed'));
      
      // Mock onAuthStateChange to only call onChange with null, not trigger anonymous user
      vi.mocked(onAuthStateChange).mockImplementation((onChange) => {
        // Call onChange with null - hook will try to sign in anonymously and fail
        onChange(null);
        // Don't call onChange again with a user
        return vi.fn();
      });

      const { result } = renderHook(() => useFirebaseAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toBeNull();
      });

      await expect(result.current.changePassword('oldPassword', 'newPassword')).rejects.toThrow(
        'No user logged in'
      );
    });
  });

  describe('getIdToken', () => {
    it('should get ID token for authenticated user', async () => {
      const { getIdToken } = await import('../../firebase/auth');
      vi.mocked(getIdToken).mockResolvedValue('mock-token');

      const { result } = renderHook(() => useFirebaseAuth());

      const token = await result.current.getIdToken();

      expect(getIdToken).toHaveBeenCalledWith(false);
      expect(token).toBe('mock-token');
    });

    it('should return null on error', async () => {
      const { getIdToken } = await import('../../firebase/auth');
      vi.mocked(getIdToken).mockRejectedValue(new Error('Token error'));

      const { result } = renderHook(() => useFirebaseAuth());

      const token = await result.current.getIdToken();

      expect(token).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from auth state changes on unmount', () => {
      mockUnsubscribe.mockClear();
      const { unmount } = renderHook(() => useFirebaseAuth());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
