/**
 * Firebase Authentication Module
 * Implements secure authentication with multiple providers
 * Per codeguard-0-authentication-mfa: Uses Firebase Auth for secure token management
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';

export type { User } from 'firebase/auth';

// Check if auth is available
const ensureAuth = () => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured. Set VITE_FIREBASE_* environment variables.');
  }
  return auth;
};

/**
 * Sign up with email and password
 * Per codeguard-0-authentication-mfa: Passwords are hashed by Firebase (uses scrypt)
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> => {
  const authInstance = ensureAuth();
  const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);

  // Update display name if provided
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }

  return userCredential;
};

/**
 * Sign in with email and password
 * Per codeguard-0-authentication-mfa: Enforce TLS for auth endpoints (handled by Firebase)
 */
export const signInWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  const authInstance = ensureAuth();
  return signInWithEmailAndPassword(authInstance, email, password);
};

/**
 * Sign in with Google OAuth
 * Per codeguard-0-authentication-mfa: Use standard OAuth2/OIDC protocols
 */
export const signInWithGoogle = async (): Promise<UserCredential> => {
  const authInstance = ensureAuth();
  const provider = new GoogleAuthProvider();

  // Request additional scopes if needed
  provider.addScope('profile');
  provider.addScope('email');

  return signInWithPopup(authInstance, provider);
};

/**
 * Sign in anonymously
 * Useful for guest users who want to try the app
 */
export const signInAnonymousUser = async (): Promise<UserCredential> => {
  const authInstance = ensureAuth();
  return signInAnonymously(authInstance);
};

/**
 * Sign out current user
 * Per codeguard-0-authentication-mfa: Rotate sessions on logout
 */
export const signOutUser = async (): Promise<void> => {
  const authInstance = ensureAuth();
  await signOut(authInstance);
};

/**
 * Send password reset email
 * Per codeguard-0-authentication-mfa: Use HTTPS reset links with short expiry
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  const authInstance = ensureAuth();
  await sendPasswordResetEmail(authInstance, email);
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  user: User,
  updates: { displayName?: string; photoURL?: string }
): Promise<void> => {
  await updateProfile(user, updates);
};

/**
 * Change user password
 * Per codeguard-0-authentication-mfa: Require re-authentication for password changes
 */
export const changePassword = async (
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  // Re-authenticate user before password change
  const credential = EmailAuthProvider.credential(user.email!, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // Update password
  await updatePassword(user, newPassword);
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  if (!isFirebaseConfigured || !auth) return null;
  return auth.currentUser;
};

/**
 * Get ID token for API authentication
 * Per codeguard-0-authentication-mfa: Short-lived tokens with rotation
 */
export const getIdToken = async (forceRefresh = false): Promise<string | null> => {
  const authInstance = ensureAuth();
  const user = authInstance.currentUser;

  if (!user) return null;

  return user.getIdToken(forceRefresh);
};

/**
 * Listen for authentication state changes
 */
export const onAuthStateChange = (
  onChange: (user: User | null) => void,
  onError?: (error: Error) => void
) => {
  const authInstance = ensureAuth();
  return onAuthStateChanged(authInstance, onChange, onError);
};
