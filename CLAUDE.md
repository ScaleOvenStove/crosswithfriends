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
```

### E2E Tests (Playwright)

Use `pnpm test:e2e:chromium` for routine agent validation checks. Run `pnpm test:e2e` only when explicitly asked for full cross-browser coverage.

```sh
pnpm test:e2e:chromium                  # Default for agent checks (Chromium only, local dev server)
pnpm test:e2e                           # All browsers against local dev server (use only when requested)
pnpm test:e2e:prod                      # All browsers against production
BASE_URL=https://testing.crosswithfriends.com pnpm test:e2e  # Against testing env
pnpm test:e2e:headed                    # Debug with visible browsers
pnpm test:e2e:ui                        # Playwright UI mode
npx playwright install                  # First-time: install browser binaries
```

E2E tests live in `e2e/` with two layers. **Smoke tests**: page rendering, navigation, puzzle list, dark mode, game page loading. **Gameplay tests**: grid interactions (cell selection, letter entry, arrow keys, direction toggle, Tab/Backspace), toolbar actions (Check, Reveal, Reset, Pencil mode), and clue panel interactions. Configurable via `BASE_URL` env var (defaults to `http://localhost:3020`). When `BASE_URL` points to localhost, Playwright auto-starts the dev server via `pnpm start` (or reuses one already running). Shared fixtures in `e2e/fixtures/` (`base.ts` for smoke, `game.ts` for gameplay).

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
```

### Full CI Equivalent

All of these must pass before merging to master:

1. ESLint (zero warnings)
2. Stylelint
3. Prettier
4. Frontend tests
5. Server tests
6. Frontend TypeCheck
7. Server TypeCheck
8. Build

## Architecture

**Frontend** (React 19, Vite): `src/` — pages in `src/pages/`, components in `src/components/` organized by feature (Game, Grid, Player, Chat, Auth, Toolbar, Upload). State via Redux-like stores in `src/store/` plus React Context (AuthContext, GlobalContext). API clients in `src/api/`. Build tooling: Vite for dev/build, Vitest for frontend tests.

**Backend** (Express + TypeScript): `server/` — routes in `server/api/`, database models in `server/model/`, auth via Passport + JWT in `server/auth/`. Entry point is `server/server.ts`.

**Real-time**: Socket.IO handles multiplayer gameplay. `server/SocketManager.ts` manages game rooms, event persistence to `game_events` table, and broadcasting. Ephemeral events (cursor, ping) are broadcast-only; others are persisted.

**Shared code**: `src/shared/types.ts` has interfaces used by both frontend and backend. Path aliases `@shared/*` and `@lib/*` resolve to `src/shared/` and `src/lib/`.

**Database**: PostgreSQL — key tables are `game_events` (move history), `game_snapshots` (solved grid state), `puzzles`, `users`, `puzzle_solves` (solve records with times), `firebase_history` (legacy game data migrated from Firebase), `user_identity_map` (links user accounts to legacy dfac_ids), `game_dismissals` (user-dismissed in-progress games). Schema scripts in `server/sql/`, with `create_fresh_db.sql` as the entry point for new environments.

**Rate limiting**: Auth endpoints use `express-rate-limit` with tiered limits — strict (10 req/15min) for login/signup, moderate (5 req/15min) for email-sending endpoints, and general (30 req/15min) for authenticated actions. Custom key generator falls back from user ID to normalized IP via `ipKeyGenerator`.

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

## Deployment

- **Frontend**: Render Static Site with `/api/*` rewrite proxying to backend (same-origin API calls)
- **Backend**: Render Web Service at `downforacross-com.onrender.com`
- **Socket.IO**: Connects directly to backend URL (not proxied)
- Cookies use `sameSite: 'lax'` since API calls go through the same-origin proxy
