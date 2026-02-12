// Backfill user_id on puzzle_solves using game_events + user_identity_map.
// For each puzzle_solve without user_id, look up the game_events for that gid
// to find which dfac_id(s) participated, then map to user_id via user_identity_map.
//
// INSTRUCTIONS:
//   Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars (or use .env.local),
//   then run:
//     node backfills/backfillPuzzleSolvesUserId.js
//
//   For a dry run (no writes):
//     DRY_RUN=1 node backfills/backfillPuzzleSolvesUserId.js

const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '..', 'server', '.env.local')});

const {Pool} = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
});

async function backfill() {
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun) console.log('DRY RUN — no writes');

  // Get all puzzle_solves without user_id
  const {rows: solves} = await pool.query(
    `SELECT pid, gid, solved_time, time_taken_to_solve
     FROM puzzle_solves
     WHERE user_id IS NULL
     ORDER BY solved_time ASC`
  );
  console.log(`Found ${solves.length} puzzle_solves without user_id`);

  let matched = 0;
  let noEvents = 0;
  let noMapping = 0;
  let errors = 0;

  for (const solve of solves) {
    // Find distinct dfac_ids from game_events for this gid
    const {rows: events} = await pool.query(
      `SELECT DISTINCT uid
       FROM game_events
       WHERE gid = $1 AND uid IS NOT NULL`,
      [solve.gid]
    );

    if (events.length === 0) {
      noEvents += 1;
      continue;
    }

    const dfacIds = events.map((e) => e.uid);

    // Map dfac_ids to user_ids
    const {rows: mappings} = await pool.query(
      `SELECT dfac_id, user_id
       FROM user_identity_map
       WHERE dfac_id = ANY($1)`,
      [dfacIds]
    );

    if (mappings.length === 0) {
      noMapping += 1;
      continue;
    }

    // Insert a solve record for each mapped user
    for (const mapping of mappings) {
      try {
        if (!dryRun) {
          await pool.query(
            `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [
              solve.pid,
              solve.gid,
              solve.solved_time,
              solve.time_taken_to_solve,
              mapping.user_id,
              dfacIds.length,
            ]
          );
        }
        matched += 1;
        if (matched % 100 === 0) {
          console.log(`  Processed ${matched} matches...`);
        }
      } catch (e) {
        errors += 1;
      }
    }
  }

  console.log(
    `Done. Matched: ${matched}, No events: ${noEvents}, No mapping: ${noMapping}, Errors: ${errors}`
  );
  await pool.end();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
