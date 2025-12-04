/**
 * useFirebaseAuth Hook Tests
 * Tests authentication hook behavior and state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useFirebaseAuth from '../firebase/useFirebaseAuth';

// Mock Firebase modules
vi.mock('@lib/firebase/config', () => ({
  auth: {
    currentUser: null,
  },
  isFirebaseConfigured: true,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Simulate initial auth state
    callback(null);
    return vi.fn(); // unsubscribe function
  }),
}));

vi.mock('@lib/firebase/auth', () => ({
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInAnonymousUser: vi.fn(),
  signOutUser: vi.fn(),
  sendPasswordReset: vi.fn(),
  updateUserProfile: vi.fn(),
  changePassword: vi.fn(),
  getIdToken: vi.fn(),
}));

describe('useFirebaseAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useFirebaseAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set loading to false if Firebase is not configured', () => {
      const { isFirebaseConfigured } = require('@lib/firebase/config');
      vi.mocked(isFirebaseConfigured).mockReturnValue(false);

      const { result } = renderHook(() => useFirebaseAuth());

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Auth State Changes', () => {
    it('should update user state when auth state changes', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      const { onAuthStateChanged } = await import('firebase/auth');

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser as any);
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
      const { signUpWithEmail } = await import('@lib/firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signUpWithEmail).mockResolvedValue({ user: mockUser } as any);

      const { result } = renderHook(() => useFirebaseAuth());

      const user = await result.current.signUp('test@example.com', 'password123', 'Test User');

      expect(signUpWithEmail).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      expect(user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should set error on sign up failure', async () => {
      const { signUpWithEmail } = await import('@lib/firebase/auth');
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
      const { signInWithEmail } = await import('@lib/firebase/auth');
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
      const { signInWithGoogle } = await import('@lib/firebase/auth');
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
      const { signInAnonymousUser } = await import('@lib/firebase/auth');
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
      const { signOutUser } = await import('@lib/firebase/auth');
      vi.mocked(signOutUser).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await result.current.signOut();

      expect(signOutUser).toHaveBeenCalled();
    });

    it('should set error on sign out failure', async () => {
      const { signOutUser } = await import('@lib/firebase/auth');
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
      const { sendPasswordReset } = await import('@lib/firebase/auth');
      vi.mocked(sendPasswordReset).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFirebaseAuth());

      await result.current.resetPassword('test@example.com');

      expect(sendPasswordReset).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      const { onAuthStateChanged } = await import('firebase/auth');
      const { updateUserProfile } = await import('@lib/firebase/auth');

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser as any);
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
    });

    it('should throw error if no user is logged in', async () => {
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.updateProfile({ displayName: 'New Name' })).rejects.toThrow(
        'No user logged in'
      );
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      const { onAuthStateChanged } = await import('firebase/auth');
      const { changePassword } = await import('@lib/firebase/auth');

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser as any);
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
      const { result } = renderHook(() => useFirebaseAuth());

      await expect(result.current.changePassword('oldPassword', 'newPassword')).rejects.toThrow(
        'No user logged in'
      );
    });
  });

  describe('getIdToken', () => {
    it('should get ID token for authenticated user', async () => {
      const { getIdToken } = await import('@lib/firebase/auth');
      vi.mocked(getIdToken).mockResolvedValue('mock-token');

      const { result } = renderHook(() => useFirebaseAuth());

      const token = await result.current.getIdToken();

      expect(getIdToken).toHaveBeenCalledWith(false);
      expect(token).toBe('mock-token');
    });

    it('should return null on error', async () => {
      const { getIdToken } = await import('@lib/firebase/auth');
      vi.mocked(getIdToken).mockRejectedValue(new Error('Token error'));

      const { result } = renderHook(() => useFirebaseAuth());

      const token = await result.current.getIdToken();

      expect(token).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from auth state changes on unmount', () => {
      const unsubscribe = vi.fn();
      const { onAuthStateChanged } = require('firebase/auth');
      vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useFirebaseAuth());

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
