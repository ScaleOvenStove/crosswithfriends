import express from 'express';
import rateLimit, {ipKeyGenerator} from 'express-rate-limit';

const router = express.Router();

// Rate limit: 60 requests/hour per IP. UptimeRobot at 5-min intervals = 12/hr.
const healthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'unknown'),
  message: {status: 'rate_limited'},
});

type CachedResult = {status: 'ok' | 'degraded'; timestamp: number};
const CACHE_TTL_MS = 60 * 1000;
let emailCache: CachedResult | null = null;
let inflightCheck: Promise<'ok' | 'degraded'> | null = null;

async function checkSendGrid(): Promise<'ok' | 'degraded'> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return 'degraded';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: {Authorization: `Bearer ${apiKey}`},
      signal: controller.signal,
    });
    return resp.ok ? 'ok' : 'degraded';
  } catch {
    return 'degraded';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @openapi
 * /health/email:
 *   get:
 *     tags: [Health]
 *     summary: Email (SendGrid) health check
 *     description: Returns 200 if the SendGrid API key is accepted by SendGrid, 503 otherwise. Cached for 60s to cap upstream cost.
 *     responses:
 *       200: {description: SendGrid reachable and authenticated}
 *       503: {description: SendGrid unreachable or API key rejected}
 *       429: {description: Rate limited}
 */
router.get('/email', healthLimiter, async (_req, res) => {
  const now = Date.now();
  if (emailCache && now - emailCache.timestamp < CACHE_TTL_MS) {
    res.status(emailCache.status === 'ok' ? 200 : 503).json({status: emailCache.status, cached: true});
    return;
  }

  // Coalesce concurrent cache misses: all callers share one in-flight SendGrid call
  if (!inflightCheck) {
    inflightCheck = checkSendGrid().finally(() => {
      inflightCheck = null;
    });
  }
  const status = await inflightCheck;
  emailCache = {status, timestamp: now};
  res.status(status === 'ok' ? 200 : 503).json({status, cached: false});
});

export default router;
