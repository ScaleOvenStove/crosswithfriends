import pg from 'pg';

import type {Config} from '../config/index.js';
import {logger} from '../utils/logger.js';

// ============= Database Operations ============

/**
 * Creates a new database connection pool
 * @param appConfig - Centralized application configuration
 * @returns A new PostgreSQL pool instance
 */
export function createPool(appConfig: Config): pg.Pool {
  const poolConfig: pg.PoolConfig = {
    // Connection pool settings for better performance
    max: appConfig.database.pool.max,
    min: appConfig.database.pool.min,
    idleTimeoutMillis: appConfig.database.pool.idleTimeoutMillis,
    connectionTimeoutMillis: appConfig.database.pool.connectionTimeoutMillis,
    statement_timeout: appConfig.database.pool.statementTimeout,
  };

  // If DATABASE_URL is provided (e.g. in Docker, Heroku, or Render), use it
  // This overrides all individual connection parameters
  // Note: Validation is handled in config/index.ts - we assume config has already validated inputs
  if (appConfig.database.connectionString) {
    poolConfig.connectionString = appConfig.database.connectionString;
    logger.info('Using DATABASE_URL connection string');
  } else {
    // Use individual connection parameters
    // Config module has already validated that both user and database are provided
    poolConfig.host = appConfig.database.host;
    poolConfig.user = appConfig.database.user;
    poolConfig.database = appConfig.database.database;
  }

  // Only set password and SSL when NOT using connectionString
  // (connectionString already contains all connection info including SSL)
  if (!appConfig.database.connectionString) {
    // Only include password if it's explicitly set and non-empty
    // Empty strings can cause SCRAM authentication errors
    if (appConfig.database.password !== undefined && appConfig.database.password !== '') {
      poolConfig.password = appConfig.database.password;
    }

    // Only include SSL config if needed
    if (appConfig.database.useSSL) {
      poolConfig.ssl = {
        rejectUnauthorized: appConfig.database.sslRejectUnauthorized,
      };

      if (!appConfig.database.sslRejectUnauthorized) {
        logger.warn(
          'SSL certificate validation is DISABLED. This should only be used in development with self-signed certificates.'
        );
      }
    }
  }

  const pool = new pg.Pool(poolConfig);

  // Add error handlers for better debugging
  pool.on('error', (err) => {
    logger.error({err}, 'Unexpected database pool error');
  });

  // Log pool events in development
  if (appConfig.server.isDevelopment) {
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

// Type export for use in dependency injection
export type DatabasePool = pg.Pool;
