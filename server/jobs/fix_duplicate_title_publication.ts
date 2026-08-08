/**
 * Repair puzzle titles where the publication name got stamped on more than
 * once by the uploading pipeline, e.g.
 *
 *   "Universal Universal Universal Crossword - Aug 8 2026"
 *   -> "Universal Crossword - Aug 8 2026"
 *
 * Rewrites content->'info'->>'title' in place rather than setting
 * titleOverride: an override makes the puzzle list render an
 * "Originally: <ugly title>" subline (see PuzzleList/Entry.tsx), which is not
 * what we want for a straight typo cleanup.
 *
 * Usage:
 *   # Dry run against the default pids (prints before/after, changes nothing):
 *   DRY_RUN=1 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json \
 *     server/jobs/fix_duplicate_title_publication.ts
 *
 *   # Apply:
 *   dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json \
 *     server/jobs/fix_duplicate_title_publication.ts
 *
 *   # Different pids:
 *   PIDS=123,456 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json \
 *     server/jobs/fix_duplicate_title_publication.ts
 *
 *   # Report every public puzzle with a repeated leading phrase, fix nothing:
 *   SCAN=1 dotenv -e server/.env.local -- npx ts-node -P server/tsconfig.json \
 *     server/jobs/fix_duplicate_title_publication.ts
 */

import pg from 'pg';
import {collapseRepeatedTitlePrefix} from './title_utils';

pg.types.setTypeParser(1114, (str: string) => new Date(str + 'Z'));

const getSslConfig = () => {
  if (process.env.PGSSL === 'disable') return undefined;
  if (process.env.NODE_ENV === 'production') return {rejectUnauthorized: false};
  return undefined;
};

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || process.env.USER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: getSslConfig(),
  statement_timeout: 120000,
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'").catch((err) => {
    console.error('Failed to set timezone for new connection.', err);
  });
});

const DRY_RUN = process.env.DRY_RUN === '1';
const SCAN = process.env.SCAN === '1';

// The two puzzles reported in production.
const DEFAULT_PIDS = ['1000011097-104', '1000011113-4'];

const PIDS = (process.env.PIDS || DEFAULT_PIDS.join(','))
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

// Postgres ARE supports backreferences, so this finds titles whose opening
// phrase is immediately repeated. Used for reporting only — the actual rewrite
// always goes through collapseRepeatedTitlePrefix.
const REPEATED_PREFIX_REGEX = String.raw`^\s*(\S.*?)\s+\1(\s|$)`;

async function scan() {
  const {rows} = await pool.query(
    `SELECT pid, content->'info'->>'title' AS title
     FROM puzzles
     WHERE is_public = true
       AND content->'info'->>'title' ~ $1
     ORDER BY pid_numeric DESC
     LIMIT 500`,
    [REPEATED_PREFIX_REGEX]
  );
  console.log(`Found ${rows.length} public puzzles with a repeated leading phrase:`);
  for (const row of rows) {
    console.log(
      `  ${row.pid}: ${JSON.stringify(row.title)} -> ${JSON.stringify(
        collapseRepeatedTitlePrefix(row.title || '')
      )}`
    );
  }
}

async function fixPids() {
  let changed = 0;
  for (const pid of PIDS) {
    const {rows} = await pool.query(`SELECT content->'info'->>'title' AS title FROM puzzles WHERE pid = $1`, [
      pid,
    ]);
    if (rows.length === 0) {
      console.log(`  ${pid}: not found`);
      continue;
    }
    const title: string = rows[0].title || '';
    const fixed = collapseRepeatedTitlePrefix(title);
    if (fixed === title) {
      console.log(`  ${pid}: already clean — ${JSON.stringify(title)}`);
      continue;
    }
    console.log(`  ${pid}: ${JSON.stringify(title)}`);
    console.log(`  ${' '.repeat(pid.length)}  -> ${JSON.stringify(fixed)}`);
    if (!DRY_RUN) {
      const result = await pool.query(
        `UPDATE puzzles
         SET content = jsonb_set(content, '{info,title}', to_jsonb($2::text), true)
         WHERE pid = $1`,
        [pid, fixed]
      );
      changed += result.rowCount || 0;
    } else {
      changed += 1;
    }
  }
  console.log('');
  console.log(`=== ${changed} title(s) ${DRY_RUN ? 'would be ' : ''}updated ===`);
  if (!DRY_RUN && changed > 0) {
    console.log('Note: the puzzle list caches for 5 minutes, so the change lands on the next refresh.');
  }
}

function describeMode(): string {
  if (SCAN) return 'SCAN';
  return DRY_RUN ? 'DRY RUN' : 'LIVE';
}

async function main() {
  console.log('=== Duplicate Publication Title Cleanup ===');
  console.log(`Mode: ${describeMode()}`);
  console.log('');

  if (SCAN) {
    await scan();
  } else {
    await fixPids();
  }

  await pool.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
