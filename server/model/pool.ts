import pg from 'pg';

import {config} from '../config/index.js';
import {logger} from '../utils/logger.js';

// ============= Database Operations ============

// Build connection config from centralized configuration
const poolConfig: pg.PoolConfig = {
  host: config.database.host,
  user: config.database.user,
  database: config.database.database,
  // Connection pool settings for better performance
  max: config.database.pool.max,
  min: config.database.pool.min,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
  statement_timeout: config.database.pool.statementTimeout,
};

// If DATABASE_URL is provided (e.g. in Docker or Heroku), use it
if (config.database.connectionString) {
  poolConfig.connectionString = config.database.connectionString;
  // Still apply our timeouts
  poolConfig.statement_timeout = config.database.pool.statementTimeout;
}

// Only include password if it's explicitly set and non-empty
// Empty strings can cause SCRAM authentication errors
if (config.database.password !== undefined && config.database.password !== '') {
  poolConfig.password = config.database.password;
}

// Only include SSL config if needed
if (config.database.useSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: config.database.sslRejectUnauthorized,
  };

  if (!config.database.sslRejectUnauthorized) {
    logger.warn(
      'SSL certificate validation is DISABLED. This should only be used in development with self-signed certificates.'
    );
  }
}

/**
 * Creates a new database connection pool
 * @returns A new PostgreSQL pool instance
 */
export function createPool(): pg.Pool {
  const pool = new pg.Pool(poolConfig);

  // Add error handlers for better debugging
  pool.on('error', (err) => {
    logger.error({err}, 'Unexpected database pool error');
  });

  // Log pool events in development
  if (config.server.isDevelopment) {
    pool.on('connect', () => {
      logger.debug('New database client connected');
    });
    pool.on('remove', () => {
      logger.debug('Database client removed from pool');
    });
  }

  return pool;
}

/**
 * Closes a database pool gracefully
 * @param pool - The pool to close
 */
export async function closePool(pool: pg.Pool): Promise<void> {
  await pool.end();
}

// Export singleton for backward compatibility (deprecated - use createPool instead)
export const pool = createPool();
