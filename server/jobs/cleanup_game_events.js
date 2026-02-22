// Automated cleanup of game_events for solved games that have snapshots.
// Deletes all events except 'create' for games where:
//   - A puzzle_solves record exists
//   - A game_snapshots record exists with replay_retained = false
//   - The snapshot is older than the grace period (default 7 days)
//
// INSTRUCTIONS:
//   Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars (or use .env.local),
//   then run:
//     node server/jobs/cleanup_game_events.js
//
//   For a dry run (no writes):
//     DRY_RUN=1 node server/jobs/cleanup_game_events.js
//
//   To change the grace period (days):
//     GRACE_DAYS=14 node server/jobs/cleanup_game_events.js

const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '..', '.env.local')}); // eslint-disable-line import/no-extraneous-dependencies

const {Pool} = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
});

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10);
const GRACE_DAYS = parseInt(process.env.GRACE_DAYS || '7', 10);

async function cleanup() {
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun) console.log('DRY RUN — no deletes');
  console.log(`Grace period: ${GRACE_DAYS} days`);

  // Find games eligible for cleanup
  const {rows: eligible} = await pool.query(
    `SELECT gs.gid
     FROM game_snapshots gs
     JOIN puzzle_solves ps ON gs.gid = ps.gid
     WHERE gs.replay_retained = false
       AND gs.created_at < NOW() - ($1 || ' days')::interval
       AND EXISTS (
         SELECT 1 FROM game_events ge
         WHERE ge.gid = gs.gid AND ge.event_type != 'create'
       )
     GROUP BY gs.gid
     LIMIT $2`,
    [String(GRACE_DAYS), BATCH_SIZE]
  );

  console.log(`Found ${eligible.length} games eligible for event cleanup`);

  if (eligible.length === 0) {
    console.log('Nothing to clean up.');
    await pool.end();
    return;
  }

  const gids = eligible.map((r) => r.gid);

  if (dryRun) {
    // Count what would be deleted
    const {
      rows: [{count}],
    } = await pool.query(
      `SELECT COUNT(*) FROM game_events
       WHERE gid = ANY($1) AND event_type != 'create'`,
      [gids]
    );
    console.log(`Would delete ${count} events from ${gids.length} games`);
  } else {
    const result = await pool.query(
      `DELETE FROM game_events
       WHERE gid = ANY($1) AND event_type != 'create'`,
      [gids]
    );
    console.log(`Deleted ${result.rowCount} events from ${gids.length} games`);
  }

  if (eligible.length === BATCH_SIZE) {
    console.log(`Batch limit reached. Run again to process more.`);
  }

  await pool.end();
}

cleanup().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
