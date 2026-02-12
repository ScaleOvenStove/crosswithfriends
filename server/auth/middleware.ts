import {Request, Response, NextFunction} from 'express';
import {verifyAccessToken, JwtPayload} from './jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: JwtPayload;
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.authUser = payload;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  optionalAuth(req, res, () => {
    if (!req.authUser) {
      res.status(401).json({error: 'Authentication required'});
      return;
    }
    next();
  });
}
