# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```sh
yarn start                              # Frontend dev server (port 3020, proxies API to production backend)
yarn devfrontend                        # Frontend pointing at local backend (port 3021)
yarn devbackend                         # Backend dev server (port 3021, watches for changes)
```

### Testing
```sh
yarn test --watchAll=false              # Frontend tests (Jest via react-scripts)
yarn test:server --ci                   # Server tests (Jest with ts-jest, separate config)
yarn test -- --testPathPattern=path     # Run a single frontend test file
yarn test:server -- --testPathPattern=path  # Run a single server test file
```

### Quality Checks
```sh
npx eslint . --ext .js,.jsx,.ts,.tsx    # Lint (CI enforces --max-warnings 0)
npx prettier --check .                  # Format check
npx prettier --write .                  # Auto-fix formatting
yarn tsc --noEmit                       # Frontend type check
yarn tsc --noEmit -p server/tsconfig.json  # Server type check
yarn build                              # Production build
```

### Full CI Equivalent
All of these must pass before merging to master:
1. ESLint (zero warnings)
2. Prettier
3. Frontend tests
4. Server tests
5. Frontend TypeCheck
6. Server TypeCheck
7. Build

## Architecture

**Frontend** (React 16, CRA v5): `src/` — pages in `src/pages/`, components in `src/components/` organized by feature (Game, Grid, Player, Chat, Auth, Toolbar, Upload). State via Redux-like stores in `src/store/` plus React Context (AuthContext, GlobalContext). API clients in `src/api/`.

**Backend** (Express + TypeScript): `server/` — routes in `server/api/`, database models in `server/model/`, auth via Passport + JWT in `server/auth/`. Entry point is `server/server.ts`.

**Real-time**: Socket.IO handles multiplayer gameplay. `server/SocketManager.ts` manages game rooms, event persistence to `game_events` table, and broadcasting. Ephemeral events (cursor, ping) are broadcast-only; others are persisted.

**Shared code**: `src/shared/types.ts` has interfaces used by both frontend and backend. Path aliases `@shared/*` and `@lib/*` resolve to `src/shared/` and `src/lib/`.

**Database**: PostgreSQL — key tables are `game_events` (move history), `game_snapshots` (solved grid state), `games`, `puzzles`, `users`. Schema scripts in `server/sql/`.

## Key Conventions

- **CSS**: BEM-style class names. Dark mode via `.dark` class on body with selectors like `.dark .component`. Centralized dark mode styles in `src/dark.css`, with some component CSS files having their own dark sections.
- **Dark mode variables**: `--dark-background` (#121212), `--dark-background-1` (rgba 0.05), `--dark-background-2` (rgba 0.12), `--dark-primary-text` (rgba 0.87), `--dark-blue-1`, `--dark-blue-2`.
- **Styling**: Material UI v4 (`@material-ui/core`), `react-icons` for icons. Prettier: 110 char width, single quotes, no bracket spacing.
- **ESLint**: airbnb-typescript base. Many a11y rules are warnings (not errors) due to legacy code. `--max-warnings 0` in CI means new warnings fail the build.
- **Pre-commit hook**: lint-staged runs ESLint + Prettier on staged files automatically.

## Deployment

- **Frontend**: Render Static Site with `/api/*` rewrite proxying to backend (same-origin API calls)
- **Backend**: Render Web Service at `downforacross-com.onrender.com`
- **Socket.IO**: Connects directly to backend URL (not proxied)
- Cookies use `sameSite: 'lax'` since API calls go through the same-origin proxy
