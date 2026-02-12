import {SERVER_URL} from './constants';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified?: boolean;
  hasPassword?: boolean;
  hasGoogle?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  user: AuthUser;
}

export async function signup(email: string, password: string, displayName: string): Promise<AuthTokens> {
  const resp = await fetch(`${SERVER_URL}/api/auth/signup`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({email, password, displayName}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Signup failed');
  }
  return resp.json();
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const resp = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({email, password}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Login failed');
  }
  return resp.json();
}

export async function refreshAccessToken(): Promise<{accessToken: string} | null> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${SERVER_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getMe(accessToken: string): Promise<AuthUser | null> {
  try {
    const resp = await fetch(`${SERVER_URL}/api/auth/me`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function linkIdentity(accessToken: string, dfacId: string): Promise<void> {
  await fetch(`${SERVER_URL}/api/auth/link-identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({dfacId}),
  });
}

export function getGoogleAuthUrl(): string {
  return `${SERVER_URL}/api/auth/google`;
}

export function getLinkGoogleUrl(accessToken: string): string {
  return `${SERVER_URL}/api/auth/link-google?token=${encodeURIComponent(accessToken)}`;
}

async function authedPost(accessToken: string, path: string, body: Record<string, any>): Promise<any> {
  const resp = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Request failed');
  }
  return resp.json();
}

export async function changeDisplayName(accessToken: string, displayName: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/change-display-name', {displayName});
}

export async function changePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string
): Promise<{accessToken: string}> {
  return authedPost(accessToken, '/api/auth/change-password', {currentPassword, newPassword});
}

export async function setPassword(accessToken: string, password: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/set-password', {password});
}

export async function changeEmail(accessToken: string, newEmail: string, password: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/change-email', {newEmail, password});
}

export async function unlinkGoogle(accessToken: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/unlink-google', {});
}

export async function deleteAccount(accessToken: string, password?: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/delete-account', {password});
}

export async function verifyEmail(token: string): Promise<void> {
  const resp = await fetch(`${SERVER_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({token}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Verification failed');
  }
}

export async function resendVerification(accessToken: string): Promise<void> {
  await authedPost(accessToken, '/api/auth/resend-verification', {});
}

export async function forgotPassword(email: string): Promise<void> {
  const resp = await fetch(`${SERVER_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Request failed');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const resp = await fetch(`${SERVER_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({token, newPassword}),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Password reset failed');
  }
}
