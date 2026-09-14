import pg from 'pg';
// ============= Database Operations ============

// All timestamps are stored as UTC (via toISOString()). Force the PG session
// timezone to UTC so that:
//  1. `timestamp without time zone` values aren't shifted by the server's local TZ
//  2. UNION ALL queries that upcast `timestamp` → `timestamptz` treat the values as UTC
//  3. `timestamptz` results are returned in UTC
pg.types.setTypeParser(1114, (str: string) => new Date(str + 'Z'));

const getSslConfig = () => {
  if (process.env.PGSSL === 'disable') return undefined;
  if (process.env.NODE_ENV === 'production') return {rejectUnauthorized: false};
  return undefined;
};

const baseConfig = {
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: getSslConfig(),
  idleTimeoutMillis: 30000, // release idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if pool is exhausted
};

/**
 * The main pool: gameplay writes, auth, and every fast (indexed, single-row)
 * read. Everything on the realtime path — `addGameEvent` in particular — runs
 * here, so its connections must stay available even when the analytics reads
 * below are slow.
 */
export const pool = new pg.Pool({
  ...baseConfig,
  max: 20, // default was 10; increase headroom for concurrent requests
  statement_timeout: 30000, // kill queries running longer than 30s
});

/**
 * A separate, deliberately small pool for the heavy profile/history reads
 * (`/api/user-stats`, `/api/user-games`).
 *
 * Those queries aggregate over a user's whole event history and can run for
 * tens of seconds. Sharing one pool with gameplay meant a handful of
 * concurrent profile loads could hold all 20 connections for the full 30s
 * statement_timeout, and `addGameEvent` would then fail its 5s connection
 * acquire and drop a player's move (Sentry NODE-EXPRESS-H, ~1000 events).
 *
 * Isolating them puts a hard ceiling on the damage: heavy reads queue against
 * each other in their own 6 connections and can never starve the write path.
 * The lower statement_timeout matches the fact that every caller of this pool
 * already degrades gracefully on timeout (see `isTransientReadFailure`) — a read
 * that has run for 10s has already missed the point of the page it feeds.
 */
export const readPool = new pg.Pool({
  ...baseConfig,
  max: 6,
  statement_timeout: 10000,
});

// Set session timezone to UTC on every new connection
const applySessionDefaults = (client: pg.PoolClient) => {
  client.query("SET timezone = 'UTC'").catch((err) => {
    console.error('Failed to set timezone for new connection. Releasing client.', err);
    client.release(err);
  });
};
pool.on('connect', applySessionDefaults);
readPool.on('connect', applySessionDefaults);

/**
 * True when an error is a Postgres statement_timeout (query cancelled after
 * exceeding `statement_timeout`). Postgres reports this with SQLSTATE 57014
 * (query_canceled). Callers on read paths can use this to degrade gracefully —
 * returning empty/partial data instead of surfacing a 500 that cascades into a
 * client-side crash — rather than treating a slow query as a hard failure.
 */
export function isStatementTimeout(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as {code?: string}).code === '57014';
}

/**
 * True when a query never ran because the pool had no free connection within
 * `connectionTimeoutMillis`. pg-pool surfaces this as a bare Error with a fixed
 * message and no SQLSTATE, so matching the message is the only option.
 */
export function isPoolAcquireTimeout(err: unknown): boolean {
  return err instanceof Error && err.message === 'timeout exceeded when trying to connect';
}

/**
 * True for either way a read can run out of capacity: the query was cancelled
 * for running too long, or it never got a connection at all. Both mean "the DB
 * is saturated right now", both are transient, and both should degrade to
 * partial data rather than 500 — a 500 here reaches the client as an HTML error
 * page that the frontend then tries to JSON.parse (JAVASCRIPT-REACT-5A/6Z).
 *
 * This matters more since heavy reads moved to `readPool`: its smaller `max`
 * makes the acquire timeout a normal back-pressure signal rather than a
 * near-impossible edge case.
 */
export function isTransientReadFailure(err: unknown): boolean {
  return isStatementTimeout(err) || isPoolAcquireTimeout(err);
}
