# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```sh
pnpm start                              # Frontend dev server (port 3020, proxies API to production backend)
pnpm devfrontend                        # Frontend pointing at local backend (port 3021)
pnpm devbackend                         # Backend dev server (port 3021, watches for changes)
```

### Testing

```sh
pnpm test                               # Frontend tests (Vitest, single run)
pnpm test:watch                         # Frontend tests in watch mode
pnpm test:server --ci                   # Server tests (Jest with ts-jest, separate config)
pnpm vitest run -- path                 # Run a single frontend test file
pnpm test:server -- --testPathPatterns=path  # Run a single server test file
pnpm test --coverage                    # Frontend tests with coverage
pnpm test:server --ci --coverage        # Server tests with coverage
```

**Coverage floors.** Both suites fail below a threshold: `vitest.config.ts` for
the frontend, `coverageThreshold` in `jest.config.server.js` for the server. The
server config uses `collectCoverageFrom` over all of `server/**/*.{ts,js}`, so a
module with no tests at all still drags the number down instead of being
invisible — JS included, since `server/gameUtils.js` is production code that
`model/game.ts` imports. The floors are a ratchet against regression, not a
target — when coverage goes up, raise them.

Route handlers are tested by mounting the real router against a mocked model
layer (`server/__mocks__/pool.ts`), not by rebuilding a stand-in app. See
`server/__tests__/api/auth-routes.test.ts` for the pattern. Tests that assert on
middleware wiring (rate limiting, `optionalAuth`) must mirror server.ts's
middleware order, or they pass against a chain that does not exist in production.

### E2E Tests (Playwright)

Use `pnpm test:e2e:chromium` for routine agent validation checks. Run `pnpm test:e2e` only when explicitly asked for full cross-browser coverage.

```sh
pnpm test:e2e:chromium                  # Default for agent checks (Chromium only, local dev server)
pnpm test:e2e                           # All browsers against local dev server (use only when requested)
pnpm test:e2e:prod                      # All browsers against production
BASE_URL=https://testing.crosswithfriends.com pnpm test:e2e  # Against testing env
pnpm test:e2e:headed                    # Debug with visible browsers
pnpm test:e2e:ui                        # Playwright UI mode
pnpm test:e2e:report                    # Open the HTML report from the last run
npx playwright install                  # First-time: install browser binaries
```

**Read-only vs write specs.** Plain `pnpm test:e2e:chromium` runs `pnpm start`,
which proxies `/api` to the _production_ backend and points Socket.IO there too
— anything a spec writes lands in the production database. Specs that write
(`multiplayer.spec.ts`, `puzzle-upload.spec.ts`) skip themselves unless pointed
at a backend that is safe to write to:

```sh
# Local stack: postgres + `psql -f server/sql/create_fresh_db.sql` +
# `psql -f loadtest/seed.sql` + `psql -f e2e/fixtures/seed-e2e.sql` +
# a server on :3021, then:
VITE_USE_LOCAL_SERVER=1 API_BASE_URL=http://localhost:3021 pnpm test:e2e:chromium
```

**The suite needs `e2e/fixtures/seed-e2e.sql`, not just the load-test seed.**
`loadtest/seed.sql` generates random grids but defines only clues 1–3, and clue
numbers come from grid geometry (`GridWrapper.assignNumbers`), not from the
stored clue keys — so every seeded mini has entries numbered above 3 that render
with no clue at all. Fine for load tests, which only exercise query shape;
fatal for any spec that asserts on the selected clue. `seed-e2e.sql` inserts
`e2e-mini-1`, a 5×5 double word square with no black squares whose numbering is
fixed (across 1/6/7/8/9, down 1/2/3/4/5). The `gamePage` fixture and the
multiplayer spec navigate straight to it; override with `E2E_PID`.

`VITE_USE_LOCAL_SERVER` switches Playwright's `webServer` to `pnpm devfrontend`,
which points the app at `:3021`. This is what the `e2e` job in `ci.yml` does, and
it is the only configuration in which the whole suite runs.

E2E tests live in `e2e/` with three layers. **Smoke tests**: page rendering, navigation, puzzle list, dark mode, game page loading. **Gameplay tests**: grid interactions (cell selection, letter entry, arrow keys, direction toggle, Tab/Backspace), toolbar actions (Check, Reveal, Reset, Pencil mode), and clue panel interactions. **Multiplayer tests** (`multiplayer.spec.ts`): two browser contexts on one game — live propagation both ways, history replay for a late joiner, reload restore, and the offline queue flushing on reconnect. That last one drives `window.socket.disconnect()`/`.connect()` rather than `context.setOffline()`, which leaves an already-open WebSocket alive and lets the event through without ever touching the queue. Configurable via `BASE_URL` env var (defaults to `http://localhost:3020`). When `BASE_URL` points to localhost, Playwright auto-starts the dev server (or reuses one already running). Shared fixtures in `e2e/fixtures/` (`base.ts` for smoke, `game.ts` for gameplay).

### Quality Checks

```sh
pnpm eslint --max-warnings 0 src/ server/  # Lint (CI enforces --max-warnings 0)
pnpm stylelint                          # CSS lint
pnpm stylelint:fix                      # CSS lint with autofix
pnpm prettier --check .                 # Format check
pnpm prettier --write .                 # Auto-fix formatting
pnpm tsc --noEmit                       # Frontend type check
pnpm tsc --noEmit -p server/tsconfig.json  # Server type check
pnpm build                              # Production build (Vite)
pnpm preview                            # Serve production build locally
pnpm size                               # Bundle size budgets (requires pnpm build first)
pnpm size:why                           # Explain what is in a chunk
```

Budgets live in `.size-limit.json`, measured brotlied, set roughly 10% above
each chunk's current size. A dependency that lands in the eager path fails the
build instead of showing up in someone's page-load time.

### Full CI Equivalent

All of these must pass before merging to master:

1. ESLint (zero warnings)
2. Stylelint
3. Prettier
4. Frontend tests (with coverage floor)
5. Server tests (with coverage floor)
6. Frontend TypeCheck
7. Server TypeCheck
8. Playwright E2E against a local postgres + server stack
9. Build, then bundle size budgets

## Architecture

**Frontend** (React 19, Vite): `src/` — pages in `src/pages/`, components in `src/components/` organized by feature (Game, Grid, Player, Chat, Auth, Toolbar, Upload). State via Redux-like stores in `src/store/` plus React Context (AuthContext, GlobalContext). API clients in `src/api/`. Build tooling: Vite for dev/build, Vitest for frontend tests.

**Backend** (Express + TypeScript): `server/` — routes in `server/api/`, database models in `server/model/`, auth via Passport + JWT in `server/auth/`. Entry point is `server/server.ts`.

**Real-time**: Socket.IO handles multiplayer gameplay. `server/SocketManager.ts` manages game rooms, event persistence to `game_events` table, and broadcasting. Ephemeral events (cursor, ping) are broadcast-only; others are persisted. The client mirrors unsent events to `localStorage` (offline queue in `src/store/game.js`) so moves survive disconnects and refreshes, flushing on reconnect.

**Shared code**: `src/shared/types.ts` has interfaces used by both frontend and backend. Path aliases `@shared/*` and `@lib/*` resolve to `src/shared/` and `src/lib/`.

**Database**: PostgreSQL — key tables are `game_events` (move history), `game_snapshots` (solved grid state), `puzzles` (also carries denormalized rating + solve-time aggregates refreshed via `refreshPuzzleRatingStats` / `refreshPuzzleSolveStats`), `puzzle_ratings` (per-user 1–5 ratings), `users`, `puzzle_solves` (solve records with times), `firebase_history` (legacy game data migrated from Firebase), `user_identity_map` (links user accounts to legacy dfac_ids), `game_dismissals` (user-dismissed in-progress games), `game_locks` (presence row = game closed to new joins), `game_bans` (per-game kicks). Schema scripts in `server/sql/`, with `create_fresh_db.sql` as the entry point for new environments.

**Game moderation**: The user who creates a game is its owner — identity (`userId` and/or `dfacId`) is stamped onto the create event's `params.creator` at game creation time. `server/model/game_moderation.ts` exposes `getGameOwner(gid)`, `isOwner(owner, caller)`, plus lock/ban operations, and caches moderation state per-gid with explicit invalidation on mutation. Owner-only mutations (lock/unlock, kick/unkick) are HTTP-only and gated via `isOwner` in `server/api/game.ts`; `server/SocketManager.ts` enforces the resulting state (bans on every event, the lock on `join_game`). Games created before this feature have no creator → no one can moderate them.

**Email**: Transactional email goes through Resend (`server/model/mailer.ts`). The `RESEND_API_KEY` must be a Full Access key (Sending Access is not enough). `/api/health/email` exposes a probe endpoint for monitoring.

**Rate limiting**: Auth endpoints use `express-rate-limit` with tiered limits — strict (10 req/15min) for login/signup, moderate (5 req/15min) for email-sending endpoints, and general (30 req/15min) for authenticated actions. Custom key generator falls back from user ID to normalized IP via `ipKeyGenerator`. The strict limiter is one instance shared across every credential endpoint, so the budget cannot be refreshed by switching routes. Per-user keying depends on the app-level `app.use(optionalAuth)` in server.ts running before the router: the limiters sit ahead of `requireAuth` in the route chain, so without it every authenticated caller silently shares one per-IP bucket. The app-wide `/api` limiter (500 req/15min) lives in `server/api/limiters.ts` so it can be tested without importing server.ts, which starts a listener.

## Key Conventions

- **CSS**: BEM-style class names. Dark mode via `.dark` class on body with selectors like `.dark .component`. Centralized dark mode styles in `src/dark.css`, with some component CSS files having their own dark sections.
- **Dark mode variables**: `--dark-background` (#121212), `--dark-background-1` (rgba 0.05), `--dark-background-2` (rgba 0.12), `--dark-primary-text` (rgba 0.87), `--dark-blue-1`, `--dark-blue-2`.
- **Styling**: Plain CSS + Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`) for accessible Dialog/Tabs. Shared CSS primitives in `src/components/common/css/primitives.css`. `react-icons` for icons. Prettier: 110 char width, single quotes, no bracket spacing.
- **ESLint**: Flat config (`eslint.config.mjs`). Many a11y rules are warnings (not errors) due to legacy code. `--max-warnings 0` in CI means new warnings fail the build.
- **Stylelint**: Config in `stylelint.config.mjs`, extends `stylelint-config-standard`. `selector-class-pattern` and `no-descending-specificity` are disabled for project conventions.
- **Pre-commit hook**: lint-staged runs ESLint + Prettier on staged JS/TS files, and Stylelint + Prettier on staged CSS files.
- **Package manager**: pnpm (managed via corepack). Run `corepack enable` once, then use `pnpm install`.

## Error Tracking (Sentry)

Sentry is opt-in via environment variables. Without the DSN set, Sentry is completely disabled (no data sent).

- **Frontend**: Set `VITE_SENTRY_DSN` in the build environment. Initialized in `src/index.js` before all other imports.
- **Backend**: Set `SENTRY_DSN` in the server environment. Initialized via `server/instrument.ts`.
- **Source maps**: Set `SENTRY_AUTH_TOKEN` in the build environment for upload during `pnpm build`.

**Frontend** uses `@sentry/react` for error tracking, performance tracing, session replay, and structured logging.

**Capturing errors**: Use `Sentry.captureException(error)` in catch blocks to report errors as Sentry Issues. The `consoleLoggingIntegration` also captures `console.log`, `console.warn`, and `console.error` as Sentry logs automatically.

**Structured logging**: Use `Sentry.logger` for structured logs:

```js
import * as Sentry from '@sentry/react';
const {logger} = Sentry;
logger.info('Updated profile', {profileId: 345});
logger.error('Failed to process payment', {orderId: 'order_123'});
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
```

**Custom spans**: Use `Sentry.startSpan()` for performance instrumentation:

```js
Sentry.startSpan({op: 'http.client', name: 'GET /api/users'}, async () => {
  const response = await fetch('/api/users');
  return response.json();
});
```

**Backend** uses `@sentry/node` for error tracking. Initialized via `server/instrument.ts` which is imported at the top of `server/server.ts`. `Sentry.setupExpressErrorHandler(app)` is registered before the custom error middleware so all unhandled errors are captured automatically.

**Backend error capture**: Use `Sentry.captureException(error)` in catch blocks. Import from `@sentry/node`:

```ts
import * as Sentry from '@sentry/node';
```

**Source maps**: The `@sentry/vite-plugin` in `vite.config.ts` uploads frontend source maps during `pnpm build` when `SENTRY_AUTH_TOKEN` is set. No token needed for local development.

## Git Operations

- When working with git worktrees, always verify which directory (worktree vs main repo) you are operating in before making edits or git operations. Run `git rev-parse --show-toplevel` to confirm.
- Before starting work on a feature branch, always run `git fetch origin && git log --oneline -5 origin/master` to check what's already merged. Do not re-implement changes that are already on master.
- When creating a PR or committing, never include local-only files (e.g., .planning files, STATE.md) unless explicitly asked. Check with the user if unsure.

## Debugging

- Before investigating a bug, ask the user for their hypothesis first. Do not go down multiple rabbit holes exploring unrelated code paths. If you haven't found the root cause after 2 attempts, stop and summarize what you've checked so the user can redirect.

## Deployment

- **Frontend**: Render Static Site with `/api/*` rewrite proxying to backend (same-origin API calls)
- **Backend**: Render Web Service at `downforacross-com.onrender.com`
- **Socket.IO**: Connects directly to backend URL (not proxied)
- Cookies use `sameSite: 'lax'` since API calls go through the same-origin proxy
