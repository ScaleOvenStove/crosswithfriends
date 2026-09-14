import * as Sentry from '@sentry/node';
import {isTransientReadFailure} from '../model/pool';

/**
 * Report a read that failed on a path which degrades to empty or partial data.
 *
 * A transient capacity failure — the query cancelled by statement_timeout, or
 * no connection free in `readPool` — is a known-slow-query signal, not a bug:
 * the caller still returns a usable response. Capturing those opened a fresh
 * Sentry Issue per occurrence for requests that succeeded from the user's point
 * of view (NODE-EXPRESS-N, 200+ events), so they go to structured logs, where
 * the slowness stays visible without paging. Anything else is a real error and
 * still captures.
 *
 * Shared by every degrading read route so one saturated endpoint can't quietly
 * reintroduce the noise the others suppress.
 */
export function reportDegradedRead(
  section: string,
  err: unknown,
  context: Record<string, unknown> = {}
): void {
  if (isTransientReadFailure(err)) {
    Sentry.logger.warn('read degraded by DB saturation', {section, ...context});
    console.warn(`${section} could not be served (DB saturated); returning degraded data`, context);
    return;
  }
  Sentry.captureException(err, {extra: {section, ...context}});
  console.error(`${section} error:`, err);
}
