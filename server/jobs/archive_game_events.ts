/**
 * Automated archival/cleanup of game_events.
 *
 * Three categories of cleanup:
 *   1. Solved games with snapshots (replay_retained=false) — delete non-create events
 *   2. Abandoned games (no snapshot, no solve, inactive for N days) — delete all events
 *   3. (Optional) Expire replay_retained flag after N days
 *
 * Usage:
 *   # Via dotenv-cli (recommended):
 *   dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/archive_game_events.ts
 *
 *   # Dry run:
 *   DRY_RUN=1 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json server/jobs/archive_game_events.ts
 *
 * Environment variables:
 *   DRY_RUN            - Set to "1" for read-only mode (default: 0)
 *   GRACE_DAYS         - Grace period for solved games in days (default: 2)
 *   ABANDON_DAYS       - Inactivity threshold for abandoned games in days (default: 90)
 *   EXPIRE_REPLAY_DAYS - Auto-expire replay_retained after N days, 0 = disabled (default: 0)
 */

import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: false} : undefined,
  statement_timeout: 600000, // 10 minutes
});

const DRY_RUN = process.env.DRY_RUN === '1';
const GRACE_DAYS = parseInt(process.env.GRACE_DAYS || '2', 10);
const ABANDON_DAYS = parseInt(process.env.ABANDON_DAYS || '90', 10);
const EXPIRE_REPLAY_DAYS = parseInt(process.env.EXPIRE_REPLAY_DAYS || '0', 10);

interface CleanupStats {
  category: string;
  gamesProcessed: number;
  eventsDeleted: number;
}

/**
 * Category 1: Delete non-create events for solved games with snapshots.
 * Keeps the create event (contains puzzle ID and game metadata).
 */
async function cleanupSolvedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'solved', gamesProcessed: 0, eventsDeleted: 0};

  if (DRY_RUN) {
    const {
      rows: [{games, events}],
    } = await pool.query(
      `SELECT
         COUNT(DISTINCT ge.gid) AS games,
         COUNT(*) AS events
       FROM game_events ge
       INNER JOIN game_snapshots gs ON gs.gid = ge.gid
       WHERE gs.replay_retained = false
         AND gs.created_at < NOW() - ($1 || ' days')::interval
         AND ge.event_type != 'create'`,
      [String(GRACE_DAYS)]
    );
    stats.gamesProcessed = Number(games);
    stats.eventsDeleted = Number(events);
    console.log(`  [DRY RUN] Would delete ${events} events from ${games} solved games`);
    return stats;
  }

  const result = await pool.query(
    `DELETE FROM game_events ge
     USING game_snapshots gs
     WHERE gs.gid = ge.gid
       AND gs.replay_retained = false
       AND gs.created_at < NOW() - ($1 || ' days')::interval
       AND ge.event_type != 'create'`,
    [String(GRACE_DAYS)]
  );
  stats.eventsDeleted = result.rowCount || 0;
  console.log(`  Deleted ${stats.eventsDeleted} events from solved games`);

  return stats;
}

/**
 * Category 2: Delete all events for abandoned games.
 * Abandoned = no snapshot, no puzzle_solves record, no activity for ABANDON_DAYS.
 */
const ABANDONED_BATCH_SIZE = 500;

async function cleanupAbandonedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'abandoned', gamesProcessed: 0, eventsDeleted: 0};

  // Step 1: Find abandoned gids (separate lightweight query)
  const {rows: abandonedGids} = await pool.query(
    `SELECT ge.gid
     FROM game_events ge
     LEFT JOIN game_snapshots gs ON gs.gid = ge.gid
     LEFT JOIN puzzle_solves ps ON ps.gid = ge.gid
     WHERE gs.gid IS NULL AND ps.gid IS NULL
     GROUP BY ge.gid
     HAVING MAX(ge.ts) < NOW() - ($1 || ' days')::interval`,
    [String(ABANDON_DAYS)]
  );

  stats.gamesProcessed = abandonedGids.length;
  console.log(`  Found ${abandonedGids.length} abandoned games`);

  if (DRY_RUN) {
    const gids = abandonedGids.map((r) => r.gid);
    if (gids.length > 0) {
      const {
        rows: [{count}],
      } = await pool.query(`SELECT COUNT(*) FROM game_events WHERE gid = ANY($1)`, [gids]);
      stats.eventsDeleted = Number(count);
    }
    console.log(
      `  [DRY RUN] Would delete ${stats.eventsDeleted} events from ${stats.gamesProcessed} abandoned games`
    );
    return stats;
  }

  // Step 2: Delete in batches by gid
  const gids = abandonedGids.map((r) => r.gid);
  for (let i = 0; i < gids.length; i += ABANDONED_BATCH_SIZE) {
    const batch = gids.slice(i, i + ABANDONED_BATCH_SIZE);
    const result = await pool.query(`DELETE FROM game_events WHERE gid = ANY($1)`, [batch]);
    const deleted = result.rowCount || 0;
    stats.eventsDeleted += deleted;
    console.log(
      `  Batch ${Math.floor(i / ABANDONED_BATCH_SIZE) + 1}: deleted ${deleted} events (${batch.length} games)`
    );
  }

  console.log(`  Deleted ${stats.eventsDeleted} events from ${stats.gamesProcessed} abandoned games`);
  return stats;
}

/**
 * Category 3: Auto-expire replay_retained flag after EXPIRE_REPLAY_DAYS.
 * Disabled by default (EXPIRE_REPLAY_DAYS=0).
 */
async function expireReplayRetention(): Promise<number> {
  if (EXPIRE_REPLAY_DAYS <= 0) return 0;

  if (DRY_RUN) {
    const {
      rows: [{count}],
    } = await pool.query(
      `SELECT COUNT(*) FROM game_snapshots
       WHERE replay_retained = true
         AND created_at < NOW() - ($1 || ' days')::interval`,
      [String(EXPIRE_REPLAY_DAYS)]
    );
    console.log(`  [DRY RUN] Would expire replay_retained for ${count} games`);
    return Number(count);
  }

  const result = await pool.query(
    `UPDATE game_snapshots
     SET replay_retained = false
     WHERE replay_retained = true
       AND created_at < NOW() - ($1 || ' days')::interval`,
    [String(EXPIRE_REPLAY_DAYS)]
  );
  const expired = result.rowCount || 0;
  if (expired > 0) {
    console.log(`  Expired replay_retained for ${expired} games`);
  }
  return expired;
}

async function main() {
  console.log('=== Game Events Archive Job ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Settings: GRACE_DAYS=${GRACE_DAYS}, ABANDON_DAYS=${ABANDON_DAYS}`);
  console.log(`  EXPIRE_REPLAY_DAYS=${EXPIRE_REPLAY_DAYS}`);
  console.log('');

  // Category 3 first — expire replays so they become eligible for Category 1
  console.log('--- Category 3: Replay retention expiry ---');
  const expired = await expireReplayRetention();
  if (expired === 0 && EXPIRE_REPLAY_DAYS <= 0) {
    console.log('  Disabled (EXPIRE_REPLAY_DAYS=0)');
  } else if (expired === 0) {
    console.log('  No replays to expire.');
  }
  console.log('');

  // Category 1 — solved games with snapshots
  console.log('--- Category 1: Solved games with snapshots ---');
  const solvedStats = await cleanupSolvedGames();
  if (solvedStats.eventsDeleted === 0) {
    console.log('  Nothing to clean up.');
  }
  console.log('');

  // Category 2 — abandoned games
  console.log('--- Category 2: Abandoned games ---');
  const abandonedStats = await cleanupAbandonedGames();
  if (abandonedStats.eventsDeleted === 0) {
    console.log('  Nothing to clean up.');
  }
  console.log('');

  // Run ANALYZE after bulk deletes to update query planner statistics
  if (!DRY_RUN && solvedStats.eventsDeleted + abandonedStats.eventsDeleted > 0) {
    console.log('--- Running ANALYZE game_events ---');
    await pool.query('ANALYZE game_events');
    console.log('  Done.');
    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Solved: ${solvedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`);
  console.log(`Abandoned: ${abandonedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`);
  if (EXPIRE_REPLAY_DAYS > 0) {
    console.log(`Replay expirations: ${expired}`);
  }
  console.log(
    `Total: ${solvedStats.eventsDeleted + abandonedStats.eventsDeleted} events ${DRY_RUN ? '(would be)' : ''} deleted`
  );

  await pool.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
