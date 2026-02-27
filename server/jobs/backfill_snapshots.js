// Backfill game_snapshots for solved games that still have events in game_events.
// Replays events through the game reducer to build the final state, then saves as snapshot.
//
// INSTRUCTIONS:
//   Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars (or use .env.local),
//   then run:
//     node server/jobs/backfill_snapshots.js
//
//   For a dry run (no writes):
//     DRY_RUN=1 node server/jobs/backfill_snapshots.js

const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '..', '.env.local')}); // eslint-disable-line import/no-extraneous-dependencies

const {Pool} = require('pg');
const {reduce} = require('../../src/lib/reducers/game');

const pool = process.env.DATABASE_URL
  ? new Pool({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}})
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      user: process.env.PGUSER || process.env.USER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
    });

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 50;

async function backfill() {
  const dryRun = process.env.DRY_RUN === '1';
  const loop = process.env.LOOP === '1';
  if (dryRun) console.log('DRY RUN — no writes');
  console.log(`Batch size: ${BATCH_SIZE}, Loop: ${loop}`);

  let totalCreated = 0;
  let totalFailed = 0;
  let round = 0;

  while (true) {
    round += 1;
    // Find solved games that don't have snapshots yet and still have events
    const {rows: games} = await pool.query(
      `SELECT DISTINCT ps.gid, ps.pid
       FROM puzzle_solves ps
       WHERE NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ps.gid)
         AND EXISTS (SELECT 1 FROM game_events ge WHERE ge.gid = ps.gid AND ge.event_type = 'create')
       ORDER BY ps.gid
       LIMIT $1`,
      [BATCH_SIZE]
    );

    console.log(`\nRound ${round}: found ${games.length} solved games without snapshots`);

    if (games.length === 0) break;

    let created = 0;
    let failed = 0;

    for (const {gid, pid} of games) {
      try {
        // Get all events for this game in order
        const {rows: eventRows} = await pool.query(
          `SELECT event_payload FROM game_events WHERE gid = $1 ORDER BY ts ASC`,
          [gid]
        );

        if (eventRows.length === 0) {
          console.log(`  ${gid}: no events, skipping`);
          continue;
        }

        // Replay events through the reducer
        let game = null;
        for (const row of eventRows) {
          const event = row.event_payload;
          game = reduce(game, event);
        }

        if (!game || !game.grid) {
          console.log(`  ${gid}: reducer produced no grid, skipping`);
          failed += 1;
          continue;
        }

        const snapshot = {
          grid: game.grid,
          users: game.users || {},
          clock: game.clock || {},
          chat: game.chat || {messages: []},
        };

        if (!dryRun) {
          await pool.query(
            `INSERT INTO game_snapshots (gid, pid, snapshot, replay_retained)
             VALUES ($1, $2, $3, false)
             ON CONFLICT (gid) DO NOTHING`,
            [gid, pid, JSON.stringify(snapshot)]
          );
        }

        created += 1;
        if (created % 100 === 0) {
          console.log(
            `  Progress: ${created}/${games.length} this round, ${totalCreated + created} total...`
          );
        }
      } catch (e) {
        console.error(`  ${gid}: error — ${e.message}`);
        failed += 1;
      }
    }

    totalCreated += created;
    totalFailed += failed;
    console.log(`Round ${round} done. Created: ${created}, Failed: ${failed}`);

    if (!loop || games.length < BATCH_SIZE) break;
  }

  console.log(`\nAll done. Total created: ${totalCreated}, Total failed: ${totalFailed}`);
  await pool.end();
}

backfill().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
