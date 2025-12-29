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
  const response = await fetch(`${API_BASE_URL}/api/auth/firebase-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ firebaseToken }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Token exchange failed' }));
    throw new Error(errorData.message || `Token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as TokenExchangeResponse;
  return data;
}

/**
 * Get the stored backend JWT token
 * @returns Backend JWT token or null if not found/expired
 */
export function getBackendToken(): string | null {
  const token = localStorage.getItem(BACKEND_TOKEN_KEY);
  const expiresAt = localStorage.getItem(BACKEND_TOKEN_EXPIRY_KEY);

  if (!token || !expiresAt) {
    return null;
  }

  // Check if token is expired
  const expiryTime = parseInt(expiresAt, 10);
  if (Date.now() >= expiryTime) {
    // Token expired, clear it
    clearBackendToken();
    return null;
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
export function isBackendTokenValid(): boolean {
  return getBackendToken() !== null;
}

/**
 * Get the stored backend token's expiration time
 * @returns Expiration timestamp (ms) or null if not found
 */
export function getBackendTokenExpiry(): number | null {
  const expiresAt = localStorage.getItem(BACKEND_TOKEN_EXPIRY_KEY);
  return expiresAt ? parseInt(expiresAt, 10) : null;
}
