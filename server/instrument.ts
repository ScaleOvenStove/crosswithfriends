import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    // Structured logs (Sentry.logger.*). Used for expected-but-worth-watching
    // conditions — e.g. a read path that tripped statement_timeout and degraded
    // gracefully — which belong in logs rather than as paging Issues.
    enableLogs: true,
  });
}
