/**
 * Authentication Token Service
 * Manages backend JWT tokens obtained via Firebase token exchange
 */

import { API_BASE_URL } from '@config/index';

const BACKEND_TOKEN_KEY = 'backend_jwt_token';
const BACKEND_TOKEN_EXPIRY_KEY = 'backend_jwt_expires_at';

interface TokenExchangeResponse {
  token: string;
  userId: string;
  expiresAt: number;
}

/**
 * Exchange a Firebase ID token for a backend JWT token
 * @param firebaseToken - Firebase ID token from Firebase Auth
 * @returns Backend JWT token and metadata
 */
export async function exchangeFirebaseToken(firebaseToken: string): Promise<TokenExchangeResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/firebase-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firebaseToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Token exchange failed' }));
    const errorMessage = errorData.message || `Token exchange failed: ${response.status}`;
    console.error('[AuthTokenService] Token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      message: errorMessage,
      errorData,
    });
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as TokenExchangeResponse;
  return data;
}

/**
 * Get the stored backend JWT token
 * @param refreshIfExpiringSoon - If true, refresh token if it expires within 5 minutes
 * @returns Backend JWT token or null if not found/expired
 */
export async function getBackendToken(refreshIfExpiringSoon = false): Promise<string | null> {
  const token = localStorage.getItem(BACKEND_TOKEN_KEY);
  const expiresAt = localStorage.getItem(BACKEND_TOKEN_EXPIRY_KEY);

  if (!token || !expiresAt) {
    return null;
  }

  // Check if token is expired
  const expiryTime = parseInt(expiresAt, 10);
  const now = Date.now();
  const timeUntilExpiry = expiryTime - now;

  if (now >= expiryTime) {
    // Token expired, clear it
    clearBackendToken();
    return null;
  }

  // If token expires within 5 minutes and refresh is requested, refresh it
  if (refreshIfExpiringSoon && timeUntilExpiry < 5 * 60 * 1000) {
    const refreshed = await refreshBackendTokenIfNeeded(true);
    return refreshed;
  }

  return token;
}

/**
 * Store the backend JWT token
 * @param token - Backend JWT token
 * @param expiresAt - Token expiration timestamp (ms)
 */
export function setBackendToken(token: string, expiresAt: number): void {
  localStorage.setItem(BACKEND_TOKEN_KEY, token);
  localStorage.setItem(BACKEND_TOKEN_EXPIRY_KEY, expiresAt.toString());
}

/**
 * Clear the stored backend JWT token
 */
export function clearBackendToken(): void {
  localStorage.removeItem(BACKEND_TOKEN_KEY);
  localStorage.removeItem(BACKEND_TOKEN_EXPIRY_KEY);
}

/**
 * Check if the stored backend token is valid (exists and not expired)
 * @returns true if token is valid, false otherwise
 */
export async function isBackendTokenValid(): Promise<boolean> {
  return (await getBackendToken()) !== null;
}

/**
 * Get the stored backend token's expiration time
 * @returns Expiration timestamp (ms) or null if not found
 */
export function getBackendTokenExpiry(): number | null {
  const expiresAt = localStorage.getItem(BACKEND_TOKEN_EXPIRY_KEY);
  return expiresAt ? parseInt(expiresAt, 10) : null;
}

/**
 * Refresh the backend token if it's missing or expired
 * Attempts to get a fresh Firebase token and exchange it for a backend JWT
 * If no user exists, attempts to sign in anonymously first
 * @param forceRefresh - If true, always refresh even if token exists
 * @returns Backend JWT token or null if refresh failed
 */
export async function refreshBackendTokenIfNeeded(forceRefresh = false): Promise<string | null> {
  // Check if we have a valid token (unless forcing refresh)
  if (!forceRefresh) {
    const existingToken = await getBackendToken(false);
    if (existingToken) {
      return existingToken;
    }
  }

  // Try to get Firebase user and exchange token
  try {
    const { auth, isFirebaseConfigured } = await import('@lib/firebase/config');
    if (!isFirebaseConfigured || !auth) {
      return null;
    }

    let firebaseUser = auth.currentUser;

    // If no user, try to sign in anonymously
    if (!firebaseUser) {
      try {
        const { signInAnonymousUser } = await import('@lib/firebase/auth');
        const result = await signInAnonymousUser();
        firebaseUser = result.user;
      } catch (err) {
        console.error('[AuthTokenService] Failed to sign in anonymously:', err);
        return null;
      }
    }

    if (!firebaseUser) {
      return null;
    }

    const firebaseToken = await firebaseUser.getIdToken(true);
    const backendTokenData = await exchangeFirebaseToken(firebaseToken);
    setBackendToken(backendTokenData.token, backendTokenData.expiresAt);
    return backendTokenData.token;
  } catch (err) {
    console.error('[AuthTokenService] Failed to refresh backend token:', err);
    return null;
  }
}
