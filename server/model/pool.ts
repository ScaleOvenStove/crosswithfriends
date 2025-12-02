import pg from 'pg';

import {logger} from '../utils/logger.js';

// ============= Database Operations ============

const host = process.env.PGHOST || 'localhost';
const isLocalhost = host === 'localhost' || host === '127.0.0.1';

// Only use SSL if explicitly required via PGSSLMODE=require
// Local PostgreSQL servers typically don't support SSL, so we disable it by default
// For production/remote databases, set PGSSLMODE=require to enable SSL
const useSSL = process.env.PGSSLMODE === 'require' && !isLocalhost;

// Build connection config - only include password if it's set and non-empty
// PostgreSQL SCRAM authentication requires password to be a non-empty string
const poolConfig: pg.PoolConfig = {
  host,
  user: process.env.PGUSER || process.env.USER,
  database: process.env.PGDATABASE,
  // Connection pool settings for better performance
  max: parseInt(process.env.PGPOOL_MAX || '20', 10), // Maximum pool size
  min: parseInt(process.env.PGPOOL_MIN || '5', 10), // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 10000, // Return error after 10s if connection cannot be established
  // Query timeout - prevent hanging queries
  statement_timeout: 30000, // 30 seconds query timeout
};

// If DATABASE_URL is provided (e.g. in Docker or Heroku), use it
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  // Override pool settings if DATABASE_URL is used (it may contain its own config)
  // But still apply our timeouts
  poolConfig.statement_timeout = 30000;
}

// Only include password if it's explicitly set and non-empty
// Empty strings can cause SCRAM authentication errors
const password = process.env.PGPASSWORD;
if (password !== undefined && password !== '') {
  poolConfig.password = password;
}

// Only include SSL config if needed
if (useSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

export const pool = new pg.Pool(poolConfig);

// Add error handlers for better debugging
pool.on('error', (err) => {
  logger.error({err}, 'Unexpected database pool error');
});

// Log pool events in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    logger.debug('New database client connected');
  });
  pool.on('remove', () => {
    logger.debug('Database client removed from pool');
  });
}
