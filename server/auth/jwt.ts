import jwt from 'jsonwebtoken';

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
const ACCESS_TOKEN_TTL = '15m';

export interface JwtPayload {
  userId: string;
  email: string | null;
  displayName: string | null;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {expiresIn: ACCESS_TOKEN_TTL});
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
