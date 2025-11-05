import pg from 'pg';
// ============= Database Operations ============

const port: number = +(process.env.PGPORT || "5432")
// For localhost development, disable SSL setup
const shouldDisableSsl = process.env.PGSSL === "disabled"

export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  port,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: shouldDisableSsl ? false : {
    rejectUnauthorized: false,
  },
});
