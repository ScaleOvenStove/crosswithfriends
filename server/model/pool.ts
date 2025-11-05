import pg from 'pg';
// ============= Database Operations ============

const port: number = +(process.env.PGPORT || "5432")

export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  port,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: false,
});
