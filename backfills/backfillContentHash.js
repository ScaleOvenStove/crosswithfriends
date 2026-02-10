// Backfill content_hash for all puzzles that don't have one yet.
// Uses the same hashing logic as server/model/puzzle.ts: SHA-256 of JSON({ clues, grid }).
//
// INSTRUCTIONS:
//   Set PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars (or use .env.local),
//   then run:
//     node backfills/backfillContentHash.js
//
//   For a dry run (no writes):
//     DRY_RUN=1 node backfills/backfillContentHash.js

const crypto = require('crypto');
const {Pool} = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
});

function computePuzzleHash(puzzle) {
  const canonical = JSON.stringify({
    clues: {across: puzzle.clues.across, down: puzzle.clues.down},
    grid: puzzle.grid,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function backfill() {
  const dryRun = process.env.DRY_RUN === '1';
  if (dryRun) console.log('DRY RUN — no updates will be written');

  const {rows} = await pool.query(
    `SELECT pid, is_public, content FROM puzzles WHERE content_hash IS NULL ORDER BY uploaded_at ASC`
  );
  console.log(`Found ${rows.length} puzzles without content_hash`);

  // Track hashes we've already assigned to public puzzles to avoid unique index violations.
  // The unique index only applies to public puzzles, so only the first public puzzle with
  // a given hash gets it set. Duplicate public puzzles are logged for manual review.
  const publicHashes = new Set();

  let updated = 0;
  let skipped = 0;
  let duplicates = 0;
  for (const row of rows) {
    const puzzle = row.content;
    if (!puzzle || !puzzle.clues || !puzzle.grid) {
      console.log(`  Skipping ${row.pid} — missing clues or grid`);
      skipped += 1;
      continue;
    }
    const hash = computePuzzleHash(puzzle);
    if (row.is_public && publicHashes.has(hash)) {
      console.log(`  Duplicate public puzzle: ${row.pid} (hash already assigned)`);
      duplicates += 1;
      continue;
    }
    if (row.is_public) {
      publicHashes.add(hash);
    }
    if (!dryRun) {
      await pool.query(`UPDATE puzzles SET content_hash = $1 WHERE pid = $2`, [hash, row.pid]);
    }
    updated += 1;
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}, Duplicate public: ${duplicates}`);
  await pool.end();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
