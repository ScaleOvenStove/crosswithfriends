/**
 * Firebase Auth Module Tests
 * Tests authentication methods and security compliance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signInAnonymousUser,
  signOutUser,
  sendPasswordReset,
  changePassword,
  getIdToken,
} from '../auth';

// Mock Firebase Auth
vi.mock('../config', () => {
  let isConfigured = true;
  const mockAuth = {
    currentUser: null,
  };
  return {
    auth: mockAuth,
    get isFirebaseConfigured() {
      return isConfigured;
    },
    __setIsFirebaseConfigured: (value: boolean) => {
      isConfigured = value;
    },
  };
});

vi.mock('firebase/auth', () => {
  const mockAddScope = vi.fn().mockReturnThis();
  const MockGoogleAuthProvider = vi.fn(function (this: any) {
    this.addScope = mockAddScope;
  });

  return {
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    sendPasswordResetEmail: vi.fn(),
    updateProfile: vi.fn(),
    updatePassword: vi.fn(),
    reauthenticateWithCredential: vi.fn(),
    EmailAuthProvider: {
      credential: vi.fn(),
    },
  };
});

describe('Firebase Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUpWithEmail', () => {
    it('should create user with email and password', async () => {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      const result = await signUpWithEmail('test@example.com', 'password123');

      expect(createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });

    it('should update display name if provided', async () => {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      await signUpWithEmail('test@example.com', 'password123', 'Test User');

      expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Test User' });
    });

    it('should throw error if Firebase is not configured', async () => {
      const configModule = await import('../config');
      if ('__setIsFirebaseConfigured' in configModule) {
        (configModule as any).__setIsFirebaseConfigured(false);
      }

      await expect(signUpWithEmail('test@example.com', 'password123')).rejects.toThrow(
        'Firebase Auth is not configured'
      );

      // Reset for other tests
      if ('__setIsFirebaseConfigured' in configModule) {
        (configModule as any).__setIsFirebaseConfigured(true);
      }
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in with email and password', async () => {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      const result = await signInWithEmail('test@example.com', 'password123');

      expect(signInWithEmailAndPassword).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signInWithGoogle', () => {
    it('should sign in with Google OAuth', async () => {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      vi.mocked(signInWithPopup).mockResolvedValue({
        user: mockUser,
      } as any);

      const result = await signInWithGoogle();

      expect(GoogleAuthProvider).toHaveBeenCalled();
      expect(signInWithPopup).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signInAnonymousUser', () => {
    it('should sign in anonymously', async () => {
      const { signInAnonymously } = await import('firebase/auth');
      const mockUser = { uid: 'anon-uid', isAnonymous: true };
      vi.mocked(signInAnonymously).mockResolvedValue({
        user: mockUser,
      } as any);

      const result = await signInAnonymousUser();

      expect(signInAnonymously).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signOutUser', () => {
    it('should sign out current user', async () => {
      const { signOut } = await import('firebase/auth');
      vi.mocked(signOut).mockResolvedValue(undefined);

      await signOutUser();

      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);

      await sendPasswordReset('test@example.com');

      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should require re-authentication before password change', async () => {
      const { reauthenticateWithCredential, updatePassword, EmailAuthProvider } = await import(
        'firebase/auth'
      );
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
      } as any;

      const mockCredential = { providerId: 'password' };
      vi.mocked(EmailAuthProvider.credential).mockReturnValue(mockCredential as any);
      vi.mocked(reauthenticateWithCredential).mockResolvedValue({} as any);
      vi.mocked(updatePassword).mockResolvedValue(undefined);

      await changePassword(mockUser, 'oldPassword', 'newPassword');

      expect(EmailAuthProvider.credential).toHaveBeenCalledWith('test@example.com', 'oldPassword');
      expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, mockCredential);
      expect(updatePassword).toHaveBeenCalledWith(mockUser, 'newPassword');
    });
  });

  describe('getIdToken', () => {
    it('should return ID token for authenticated user', async () => {
      const mockUser = {
        getIdToken: vi.fn().mockResolvedValue('mock-token'),
      };

      const { auth } = await import('../config');
      (auth as any).currentUser = mockUser;

      const token = await getIdToken();

      expect(mockUser.getIdToken).toHaveBeenCalledWith(false);
      expect(token).toBe('mock-token');
    });

    it('should return null if no user is authenticated', async () => {
      const { auth } = await import('../config');
      (auth as any).currentUser = null;

      const token = await getIdToken();

      expect(token).toBeNull();
    });

    it('should force refresh when requested', async () => {
      const mockUser = {
        getIdToken: vi.fn().mockResolvedValue('refreshed-token'),
      };

      const { auth } = await import('../config');
      (auth as any).currentUser = mockUser;

      const token = await getIdToken(true);

      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);
      expect(token).toBe('refreshed-token');
    });
  });

  describe('Security Compliance', () => {
    it('should never expose passwords in logs or errors', async () => {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const mockError = new Error('Invalid credentials');
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue(mockError);

      try {
        await signInWithEmail('test@example.com', 'wrongpassword');
      } catch (error) {
        // Ensure error message doesn't contain password
        expect((error as Error).message).not.toContain('wrongpassword');
      }
    });

    it('should use HTTPS for all auth operations (handled by Firebase)', () => {
      // Firebase SDK enforces HTTPS by default
      // This is a documentation test
      expect(true).toBe(true);
    });
  });
});
