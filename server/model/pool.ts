import pg from 'pg';
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
};

// If DATABASE_URL is provided (e.g. in Docker or Heroku), use it
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
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
