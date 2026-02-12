import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION';
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
