/**
 * Automated archival/cleanup of game_events.
 *
 * Three categories of cleanup:
 *   1. Solved games with snapshots (replay_retained=false) — delete non-create events
 *   2. Abandoned games (no snapshot, no solve, inactive for N days) — delete all events
 *   3. (Optional) Expire replay_retained flag after N days
 *
 * All discovery queries are keyset-paginated (bounded windows over an indexed
 * key) and deletes are batched by gid, so no single statement scans the whole
 * table or can approach the statement timeout. Deletes happen as each page is
 * discovered, so progress is durable even if a run is interrupted.
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
const ABANDON_DAYS = parseInt(process.env.ABANDON_DAYS || '90', 10);
const EXPIRE_REPLAY_DAYS = parseInt(process.env.EXPIRE_REPLAY_DAYS || '0', 10);

// Each discovery statement scans at most this many gids (one bounded window of
// an ordered index scan), and each DELETE targets at most DELETE_BATCH_SIZE gids.
const DISCOVERY_PAGE_SIZE = 5000;
const DELETE_BATCH_SIZE = 500;

interface CleanupStats {
  category: string;
  gamesProcessed: number;
  eventsDeleted: number;
}

/**
 * Run a batched DELETE (or its COUNT equivalent in dry-run mode) over the
 * given gids, DELETE_BATCH_SIZE gids per statement. Both statements take the
 * gid batch as $1. Returns total rows affected.
 */
async function processGidBatches(gids: string[], deleteSql: string, countSql: string): Promise<number> {
  let affected = 0;
  for (let i = 0; i < gids.length; i += DELETE_BATCH_SIZE) {
    const batch = gids.slice(i, i + DELETE_BATCH_SIZE);
    if (DRY_RUN) {
      const {
        rows: [{count}],
      } = await pool.query(countSql, [batch]);
      affected += Number(count);
    } else {
      const result = await pool.query(deleteSql, [batch]);
      affected += result.rowCount || 0;
    }
  }
  return affected;
}

// Category 1 delete re-checks replay_retained at delete time, so a keep-replay
// request landing between discovery and delete is still honored.
const SOLVED_DELETE_SQL = `
  DELETE FROM game_events ge
  USING game_snapshots gs
  WHERE gs.gid = ge.gid
    AND gs.replay_retained = false
    AND ge.gid = ANY($1)
    AND ge.event_type != 'create'`;
const SOLVED_COUNT_SQL = `
  SELECT COUNT(*) FROM game_events ge
  JOIN game_snapshots gs ON gs.gid = ge.gid
  WHERE gs.replay_retained = false
    AND ge.gid = ANY($1)
    AND ge.event_type != 'create'`;

// Category 2 delete re-checks that no snapshot or solve record appeared
// between discovery and delete (e.g. the game was solved in that window).
const ABANDONED_DELETE_SQL = `
  DELETE FROM game_events ge
  WHERE ge.gid = ANY($1)
    AND NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ge.gid)
    AND NOT EXISTS (SELECT 1 FROM puzzle_solves ps WHERE ps.gid = ge.gid)`;
const ABANDONED_COUNT_SQL = `
  SELECT COUNT(*) FROM game_events ge
  WHERE ge.gid = ANY($1)
    AND NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = ge.gid)
    AND NOT EXISTS (SELECT 1 FROM puzzle_solves ps WHERE ps.gid = ge.gid)`;

/**
 * Category 1: Delete non-create events for solved games with snapshots.
 * Keeps the create event (contains puzzle ID and game metadata).
 *
 * Pages over game_snapshots by gid (its PK); each page checks which snapshots
 * still have non-create events left (cheap per-gid index probes) and cleans
 * those before moving on.
 */
async function cleanupSolvedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'solved', gamesProcessed: 0, eventsDeleted: 0};

  let lastGid = '';
  for (;;) {
    const {rows} = await pool.query(
      `WITH page AS (
         SELECT gid, replay_retained
         FROM game_snapshots
         WHERE gid > $1
         ORDER BY gid
         LIMIT $2
       )
       SELECT p.gid,
              (p.replay_retained = false
               AND EXISTS (
                 SELECT 1 FROM game_events ge
                 WHERE ge.gid = p.gid AND ge.event_type != 'create'
               )) AS needs_cleanup
       FROM page p
       ORDER BY p.gid`,
      [lastGid, DISCOVERY_PAGE_SIZE]
    );
    if (rows.length === 0) break;
    lastGid = rows[rows.length - 1].gid;

    const gids = rows.filter((r) => r.needs_cleanup).map((r) => r.gid);
    if (gids.length > 0) {
      stats.gamesProcessed += gids.length;
      stats.eventsDeleted += await processGidBatches(gids, SOLVED_DELETE_SQL, SOLVED_COUNT_SQL);
    }

    if (rows.length < DISCOVERY_PAGE_SIZE) break;
  }

  console.log(
    `  ${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleted'} ${stats.eventsDeleted} events from ${stats.gamesProcessed} solved games`
  );
  return stats;
}

/**
 * Category 2: Delete all events for abandoned games.
 * Abandoned = no snapshot, no puzzle_solves record, no activity for ABANDON_DAYS.
 *
 * Pages over distinct gids via the (gid, ts) index — each window aggregates
 * MAX(ts) for a bounded slice of gids, flags the abandoned ones with per-gid
 * snapshot/solve probes, and deletes them before advancing the keyset.
 */
async function cleanupAbandonedGames(): Promise<CleanupStats> {
  const stats: CleanupStats = {category: 'abandoned', gamesProcessed: 0, eventsDeleted: 0};

  let lastGid = '';
  for (;;) {
    const {rows} = await pool.query(
      `WITH page AS (
         SELECT ge.gid, MAX(ge.ts) AS last_ts
         FROM game_events ge
         WHERE ge.gid > $1
         GROUP BY ge.gid
         ORDER BY ge.gid
         LIMIT $2
       )
       SELECT p.gid,
              (p.last_ts < (NOW() AT TIME ZONE 'UTC') - ($3 || ' days')::interval
               AND NOT EXISTS (SELECT 1 FROM game_snapshots gs WHERE gs.gid = p.gid)
               AND NOT EXISTS (SELECT 1 FROM puzzle_solves ps WHERE ps.gid = p.gid)) AS abandoned
       FROM page p
       ORDER BY p.gid`,
      [lastGid, DISCOVERY_PAGE_SIZE, String(ABANDON_DAYS)]
    );
    if (rows.length === 0) break;
    lastGid = rows[rows.length - 1].gid;

    const gids = rows.filter((r) => r.abandoned).map((r) => r.gid);
    if (gids.length > 0) {
      stats.gamesProcessed += gids.length;
      const affected = await processGidBatches(gids, ABANDONED_DELETE_SQL, ABANDONED_COUNT_SQL);
      stats.eventsDeleted += affected;
      console.log(
        `  ${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleted'} ${affected} events from ${gids.length} abandoned games (through gid ${lastGid})`
      );
    }

    if (rows.length < DISCOVERY_PAGE_SIZE) break;
  }

  console.log(
    `  ${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleted'} ${stats.eventsDeleted} events from ${stats.gamesProcessed} abandoned games total`
  );
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
  console.log(`Settings: ABANDON_DAYS=${ABANDON_DAYS}`);
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
