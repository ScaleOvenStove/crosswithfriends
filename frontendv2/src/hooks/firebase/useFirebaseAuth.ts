/**
 * useFirebaseAuth - Hook for Firebase Authentication
 * Provides auth state and methods
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@lib/firebase/config';
import * as authMethods from '@lib/firebase/auth';

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sign up with email
  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      setError(null);
      const result = await authMethods.signUpWithEmail(email, password, displayName);
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Sign in with email
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const result = await authMethods.signInWithEmail(email, password);
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const result = await authMethods.signInWithGoogle();
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google sign in failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Sign in anonymously
  const signInAnonymously = async () => {
    try {
      setError(null);
      const result = await authMethods.signInAnonymousUser();
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Anonymous sign in failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      await authMethods.signOutUser();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign out failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Send password reset email
  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await authMethods.sendPasswordReset(email);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Update profile
  const updateProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!user) throw new Error('No user logged in');

    try {
      setError(null);
      await authMethods.updateUserProfile(user, updates);
      // Reload user to get updated profile and preserve prototype
      await user.reload();
      setUser(user);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Profile update failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('No user logged in');

    try {
      setError(null);
      await authMethods.changePassword(user, currentPassword, newPassword);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password change failed';
      setError(errorMessage);
      throw err;
    }
  };

  // Get ID token
  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      return await authMethods.getIdToken(forceRefresh);
    } catch (err) {
      console.error('Error getting ID token:', err);
      return null;
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInWithGoogle,
    signInAnonymously,
    signOut,
    resetPassword,
    updateProfile,
    changePassword,
    getIdToken,
  };
};

export default useFirebaseAuth;
