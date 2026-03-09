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

export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: getSslConfig(),
});

// Set session timezone to UTC on every new connection
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'UTC'");
});
