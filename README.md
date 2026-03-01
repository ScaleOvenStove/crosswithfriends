## Cross with Friends

Cross with Friends is an online platform for sharing crossword puzzles and solving them collaboratively with friends in real time.

Hosted at [crosswithfriends.com](https://www.crosswithfriends.com).

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript/JavaScript
- **Backend:** Express, Socket.IO (real-time gameplay), PostgreSQL
- **Auth:** Google OAuth, email/password with JWT sessions
- **Infrastructure:** Render (hosting + managed Postgres)
- **Monitoring:** Sentry (error tracking, performance, session replay)
- **CI:** GitHub Actions (ESLint, Prettier, TypeCheck, Tests, Build)

## Recent Changes

### User Accounts & Authentication

- Google OAuth and email/password sign-up with JWT cookie sessions
- User profiles with solve history, stats, and privacy toggle
- Email verification via SendGrid
- Solve history backfill on signup from existing game data

### Game Snapshots & Event Optimization

- New `game_snapshots` table captures final grid state when a puzzle is solved
- Ephemeral events (`updateCursor`, `addPing`, `updateDisplayName`, `updateColor`) are broadcast via socket but no longer persisted to `game_events`, eliminating ~40-60% of DB writes
- "Save Replay" opt-in lets users preserve full replay data from automated cleanup
- Replay page falls back to snapshot view when events have been pruned
- Backfill and cleanup scripts for managing historical data (`server/jobs/`)

### Connection & Reliability

- Reconnection retry loop with two-tier warning banner (replacing the old disconnect alert)
- Fixed socket.io v4 connection status indicator and engine ping rebinding
- CORS fixes for cross-origin cookie handling

### Security

- Helmet middleware for security response headers
- Content hash deduplication to prevent duplicate public puzzle uploads
- Express 4.21, body-parser 1.20, moment 2.30 upgrades for known CVE fixes

### Testing & CI

- Expanded test coverage to 310 tests across 21 suites
- Split CI into separate frontend/backend jobs for faster feedback
- Branch protection on `master`: requires ESLint, Prettier, Tests (Frontend + Server), TypeCheck (Frontend + Server), and Build checks

## Getting Started

1. Clone the repo and use Node 20:

   ```sh
   git clone https://github.com/ScaleOvenStove/crosswithfriends.git
   cd crosswithfriends
   nvm install && nvm use
   corepack enable
   pnpm install
   ```

2. Start the dev server:

   ```sh
   pnpm start
   ```

   This is all you need for **frontend development**. The Vite dev server automatically proxies `/api/*` requests to the production backend — no local server or database required.

3. **(Optional) Full-stack development** — if you need to work on the backend:

   Copy `server/.env.example` to `server/.env.local` and fill in your Postgres credentials, then:

   ```sh
   VITE_USE_LOCAL_SERVER=1 pnpm start
   ```

## Development Workflow

This project uses ESLint, Prettier, and Vitest. CI runs all checks on every pull request.

**Run tests:**

```sh
pnpm test
```

**Lint:**

```sh
pnpm eslint --max-warnings 0 src/ server/
```

**Check formatting:**

```sh
pnpm prettier --check .
```

**Production build:**

```sh
pnpm build
```

A pre-commit hook (via Husky + lint-staged) automatically lints and formats staged files on commit.

**E2E tests (Playwright):**

```sh
pnpm test:e2e                # Run against local dev server (all browsers)
pnpm test:e2e:chromium       # Quick single-browser run

# Run against production explicitly
pnpm test:e2e:prod

# Run against a different environment
BASE_URL=https://testing.crosswithfriends.com pnpm test:e2e
```

First-time setup: `npx playwright install` to download browser binaries.

Tests are organized in two layers:

- **Smoke tests** — page rendering, navigation, puzzle list, dark mode, game page loading
- **Gameplay tests** — grid interactions (cell selection, letter entry, keyboard navigation), toolbar actions (Check, Reveal, Reset, Pencil mode), and clue panel interactions

## Database Scripts

Scripts in `server/jobs/` for database maintenance:

- **`backfill_snapshots.js`** — Creates snapshots for historical solved games by replaying events through the game reducer. Supports `DATABASE_URL`, configurable `BATCH_SIZE`, and `LOOP=1` for continuous processing.
- **`cleanup_game_events.js`** — Removes non-create events from solved+snapshotted games, respecting `replay_retained` flag and a 7-day grace period. Supports `DRY_RUN=1`.

Both scripts load config from `server/.env.local` by default, or accept a `DATABASE_URL` env var for remote databases.

## Contributing

Cross with Friends is open to contributions from developers of any level.

If you notice a bug or have a feature request, feel free to open an issue.

Join the [Discord](https://discord.gg/RmjCV8EZ73) for discussion.

## Tips

Developing for mobile web:

- Mobile device emulator: https://appetize.io/demo
- Public URLs for local server: [ngrok](https://ngrok.com/)
- Remote debugging tips: https://support.brightcove.com/debugging-mobile-devices
