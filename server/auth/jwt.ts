import jwt from 'jsonwebtoken';
import {ACCESS_TOKEN_TTL_SECONDS, isAccessTokenRevoked} from './access_revocation';

const DEV_FALLBACK_SECRET = 'CHANGE_ME_IN_PRODUCTION';

// Resolve the signing secret at startup. In production a real secret is
// mandatory: signing tokens with a publicly known default would let anyone
// forge a valid token for any account. Outside production we allow a fallback
// so local dev and tests run without extra setup.
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === DEV_FALLBACK_SECRET) {
      throw new Error('JWT_SECRET must be set to a strong, non-default value in production');
    }
    if (secret.length < 32) {
      console.warn('[auth] JWT_SECRET is shorter than 32 characters; use a longer random value');
    }
    return secret;
  }
  return secret || DEV_FALLBACK_SECRET;
}

const JWT_SECRET = resolveJwtSecret();

export interface JwtPayload {
  userId: string;
  email: string | null;
  displayName: string | null;
  // Standard claims, set by jsonwebtoken on sign; present on every
  // verified token, absent on the payload passed in to signAccessToken.
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {expiresIn: ACCESS_TOKEN_TTL_SECONDS});
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (isAccessTokenRevoked(payload.userId, payload.iat)) return null;
    return payload;
  } catch {
    return null;
  }
}

// For credentials checked once and then held for a long time (a socket
// keeps its handshake token for the life of the connection): is the
// verified payload still good right now? It stops being good when the token
// expires or when the user's tokens are revoked after the handshake.
export function isAccessTokenPayloadLive(payload: JwtPayload): boolean {
  if (payload.exp !== undefined && payload.exp * 1000 <= Date.now()) return false;
  return !isAccessTokenRevoked(payload.userId, payload.iat);
}
