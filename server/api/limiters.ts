import rateLimit from 'express-rate-limit';

/**
 * App-wide limiter mounted on `/api` in server.ts.
 *
 * It lives here rather than inline in server.ts so tests can exercise the real
 * configuration: importing server.ts starts an HTTP listener, opens the DB
 * pool and constructs the Socket.IO server, none of which a limiter test wants.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {error: 'Too many requests, please try again later.'},
  skip: () => process.env.DISABLE_RATE_LIMITS === 'true' || process.env.NODE_ENV === 'test',
});
