/**
 * Seed a test user account with fake solved puzzles, in-progress games, and uploads.
 * Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   pnpm seed:test-profile
 *
 * Credentials after seeding:
 *   Email:    test@seed.example.com
 *   Password: SeedPassword1!
 *
 * To wipe all seed data:
 *   DELETE FROM puzzles WHERE pid LIKE 'seed-puz-%';
 *   DELETE FROM users WHERE email = 'test@seed.example.com';
 *   (puzzle_solves and game_events cascade or use the dfac_id / user_id)
 */

import bcrypt from 'bcrypt';
import {pool} from '../model/pool';

// ── Config ────────────────────────────────────────────────────────────────────

const EMAIL = 'test@seed.example.com';
const PASSWORD = 'SeedPassword1!';
const DISPLAY_NAME = 'Seed Tester';
const DFAC_ID = 'seed-test-dfac-id-v1'; // legacy game identity for in-progress lookup

const NUM_HISTORY = 25; // puzzle_solves rows (solve history)
const NUM_IN_PROGRESS = 15; // open games (no snapshot = shows as in-progress)
const NUM_UPLOADS = 10; // puzzles with uploaded_by = test user

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIZES: {rows: number; cols: number}[] = [
  {rows: 15, cols: 15},
  {rows: 15, cols: 15},
  {rows: 15, cols: 15},
  {rows: 7, cols: 7},
  {rows: 5, cols: 5},
];

const DAY_WORDS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function makeGrid(rows: number, cols: number): string[][] {
  return Array.from({length: rows}, () => Array.from({length: cols}, () => '.'));
}

function makePuzzleContent(title: string, rows: number, cols: number): string {
  return JSON.stringify({
    info: {title, author: 'Seed Bot'},
    grid: makeGrid(rows, cols),
    clues: {across: {}, down: {}},
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding test profile…\n');

  // 1. Create or find the test user
  let userId: string;
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [EMAIL]);

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    console.log(`  user already exists   ${userId}`);
  } else {
    const hash = await bcrypt.hash(PASSWORD, 12);
    const result = await pool.query(
      `INSERT INTO users
         (email, password_hash, display_name, auth_provider, profile_is_public, email_verified_at)
       VALUES ($1, $2, $3, 'local', true, NOW())
       RETURNING id`,
      [EMAIL, hash, DISPLAY_NAME]
    );
    userId = result.rows[0].id;
    console.log(`  created user          ${userId}`);
  }

  // 2. Ensure user_identity_map entry (required for in-progress game lookup)
  await pool.query(
    `INSERT INTO user_identity_map (user_id, dfac_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, DFAC_ID]
  );
  console.log(`  dfac_id               ${DFAC_ID}`);

  // 3. Seed puzzles
  //    pids 1–25  → history puzzles (first 10 also marked as uploaded by test user)
  //    pids 26–40 → in-progress puzzles
  const totalPuzzles = NUM_HISTORY + NUM_IN_PROGRESS;
  let puzzlesCreated = 0;
  const pids: string[] = [];

  for (let i = 1; i <= totalPuzzles; i++) {
    const pid = `seed-puz-${String(i).padStart(3, '0')}`;
    pids.push(pid);

    const size = SIZES[i % SIZES.length];
    const day = DAY_WORDS[i % DAY_WORDS.length];
    const title = `${day} Seed Puzzle #${i}`;
    const content = makePuzzleContent(title, size.rows, size.cols);
    const uploadedBy = i <= NUM_UPLOADS ? userId : null;

    const r = await pool.query(
      `INSERT INTO puzzles (pid, is_public, uploaded_at, times_solved, content, uploaded_by)
       VALUES ($1, true, NOW() - ($2 || ' days')::interval, $3, $4, $5)
       ON CONFLICT (pid) DO NOTHING`,
      [pid, String(i * 3), i <= NUM_HISTORY ? 1 : 0, content, uploadedBy]
    );
    if ((r.rowCount ?? 0) > 0) puzzlesCreated += 1;
  }

  console.log(
    `  puzzles               ${puzzlesCreated} created, ${totalPuzzles - puzzlesCreated} already existed`
  );

  // 4. Seed solve history (first NUM_HISTORY puzzles)
  let solvesCreated = 0;

  for (let i = 0; i < NUM_HISTORY; i++) {
    const pid = pids[i];
    const gid = `seed-solved-${String(i + 1).padStart(3, '0')}`;
    // time_taken_to_solve is in seconds; vary by size (bigger = slower)
    const timeSec = randBetween(90, 1800);
    const solvedAt = daysAgo(i * 2 + 1); // spread over past ~50 days
    const playerCount = i % 5 === 0 ? 2 : 1; // every 5th is a co-op solve

    const r = await pool.query(
      `INSERT INTO puzzle_solves (pid, gid, solved_time, time_taken_to_solve, user_id, player_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [pid, gid, solvedAt, timeSec, userId, playerCount]
    );
    if ((r.rowCount ?? 0) > 0) solvesCreated += 1;
  }

  console.log(
    `  solve history         ${solvesCreated} created, ${NUM_HISTORY - solvesCreated} already existed`
  );

  // 5. Seed in-progress games (last NUM_IN_PROGRESS puzzles)
  let gamesCreated = 0;

  for (let i = 0; i < NUM_IN_PROGRESS; i++) {
    const pid = pids[NUM_HISTORY + i];
    const gid = `seed-inprog-${String(i + 1).padStart(3, '0')}`;

    const alreadyExists = await pool.query('SELECT 1 FROM game_events WHERE gid = $1 LIMIT 1', [gid]);
    if (alreadyExists.rows.length > 0) continue;

    const ts = daysAgo(i + 1);

    // 'create' event gives the game its pid
    await pool.query(
      `INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
       VALUES ($1, $2, $3, 'create', $4)`,
      [gid, DFAC_ID, ts, JSON.stringify({params: {pid}})]
    );

    // participation event marks the test user as a player in this game
    await pool.query(
      `INSERT INTO game_events (gid, uid, ts, event_type, event_payload)
       VALUES ($1, $2, $3, 'updateCell', $4)`,
      [gid, DFAC_ID, ts, JSON.stringify({params: {cell: 0, value: 'A', pencil: false}})]
    );

    gamesCreated += 1;
  }

  console.log(
    `  in-progress games     ${gamesCreated} created, ${NUM_IN_PROGRESS - gamesCreated} already existed`
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
Done!
  Email:    ${EMAIL}
  Password: ${PASSWORD}
  User ID:  ${userId}
  Profile:  /profile/${userId}

To remove all seed data:
  DELETE FROM puzzles WHERE pid LIKE 'seed-puz-%';
  DELETE FROM users    WHERE email = '${EMAIL}';
`);

  await pool.end();
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  pool.end().finally(() => process.exit(1));
});
