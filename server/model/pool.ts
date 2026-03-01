import pg from 'pg';
// ============= Database Operations ============

const getSslConfig = () => {
  if (process.env.PGSSL === 'disable') return undefined;
  if (process.env.NODE_ENV === 'production') return {rejectUnauthorized: false};
  return undefined;
};

export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: getSslConfig(),
});
