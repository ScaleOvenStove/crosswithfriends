# Full Frontend Modernization Plan

> **Note:** This document was written when the project used Yarn Classic. Commands shown as `yarn ...` in historical phase descriptions should be read as `pnpm ...` going forward. The project migrated to pnpm in Phase 8.

## Context

The app is on React 17 (on the `upgrade-react-17` branch, deployed to testing). The goal is to modernize the entire frontend stack incrementally — reaching React 19 while replacing dead/deprecated dependencies along the way. CRA is dead, MUI v4 is end-of-life, and Firebase needs upgrading to the modular SDK and migrated to a new CWF-owned project.

The React 19 branch (`feature/update-frontend-to-react-19`) attempted everything at once (Vite, Fastify, monorepo, React 19, MUI v6, Zustand) and is too diverged to merge. This plan takes the incremental approach — one layer at a time, each deployable and testable.

**Starting point:** `master` branch (was React 17, CRA, MUI v4, react-router v5 — now fully modernized through Phase 6)

---

## Phase 1: Build Tooling — CRA → Vite + Jest → Vitest + TypeScript 5 ✅ COMPLETE

**PR:** [#205](https://github.com/ScaleOvenStove/crosswithfriends/pull/205) (`feature/cra-to-vite`)

### What was done

1. **Removed dead packages:** `react-fontawesome`, `superagent`, `@babel/node` (note: `react-timestamp` and `left-pad` are actually used — kept)
2. **Removed `react-scripts`** and added `vite@^5`, `@vitejs/plugin-react@^4`, `eslint@^8`, `jest@^29` as direct devDeps (eslint/jest were bundled inside react-scripts)
3. **Added `async@^3.2.0`** as direct dependency (was transitive via react-scripts, needed by `battle.js`)
4. **Created `vite.config.ts`** with:
   - Custom `treat-js-as-jsx` pre-transform plugin (CRA allowed JSX in `.js` files; Vite doesn't natively)
   - API proxy config (`/api` → production backend)
   - Path aliases (`@shared`, `@lib`)
   - `define` shim for `process.env.PUBLIC_URL` (108 occurrences in partyParrot.js)
   - `optimizeDeps.esbuildOptions` for `.js` → JSX loader
5. **Created `vitest.config.ts`** with jsdom environment, `globals: true`, same JSX plugin
6. **Moved `public/index.html` → root `index.html`**, replaced `%PUBLIC_URL%` refs, added Vite module entry point
7. **Migrated env vars** in 4 files:
   - `src/api/constants.ts` — `REACT_APP_API_URL` → `VITE_API_URL`, `REACT_APP_USE_LOCAL_SERVER` → `VITE_USE_LOCAL_SERVER`, `NODE_ENV === 'development'` → `import.meta.env.DEV`
   - `src/store/firebase.js` — `REACT_APP_ENV` → `VITE_ENV`, `NODE_ENV` → `import.meta.env.MODE`
   - `src/pages/Game.js` — `REACT_APP_MAINTENANCE_MESSAGE` → `VITE_MAINTENANCE_MESSAGE`
   - `src/components/PuzzleList/NewPuzzleList.tsx` — same maintenance message change
8. **Upgraded TypeScript 4.9 → 5.4** with tsconfig updates:
   - `tsconfig.base.json`: target `es2015`, module `esnext`, moduleResolution `bundler`, jsx `react-jsx`
   - `tsconfig.json`: fixed `paths` bug (was at root level, moved into `compilerOptions`), added `vitest/globals` types
   - `server/tsconfig.json`: added `module: esnext`, `moduleResolution: bundler`, `types: ["vite/client", "jest", "node"]` (needed because server transitively resolves frontend files with `import.meta.env`)
9. **Migrated 6 test files** from `jest.*` → `vi.*` APIs; 14 test files needed no changes (globals only)
10. **Replaced type declarations:** deleted `src/react-app-env.d.ts`, created `src/vite-env.d.ts`
11. **Deleted `.babelrc`**, inlined babel preset in `jest.config.server.js` for server tests
12. **Updated CI workflow:** `yarn test --watchAll=false --ci` → `yarn test` (runs `vitest run`)
13. **Updated `CLAUDE.md`** with new commands and architecture notes
14. **Removed from `package.json`:** `proxy` field, `browserslist` section, `eject` script, `@typescript-eslint` resolutions

### Render deployment notes

No build command or output directory changes needed. Rename frontend env vars on testing and production:

- `REACT_APP_API_URL` → `VITE_API_URL`
- `REACT_APP_MAINTENANCE_MESSAGE` → `VITE_MAINTENANCE_MESSAGE`

### Verified

- `yarn start` — Vite dev server on :3020 ✅
- `yarn build` — produces `build/` directory ✅
- `yarn test` — 347 frontend tests pass (Vitest) ✅
- `yarn test:server --ci` — 158 server tests pass (Jest) ✅
- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- `npx eslint . --ext .js,.jsx,.ts,.tsx` — 0 warnings ✅
- `npx prettier --check .` — passes ✅
- Playwright E2E — 35 tests pass (chromium) ✅
- Manual smoke test — basic clicking around works ✅

---

## Phase 2: React 17 → 18 ✅ COMPLETE

**PR:** [#207](https://github.com/ScaleOvenStove/crosswithfriends/pull/207) (`feature/react-18`)

### What was done

1. Bumped `react`, `react-dom` to `^18.0.0` (installed 18.3.1)
2. Bumped `@types/react`, `@types/react-dom` to `^18.0.0`
3. Updated `src/index.js`: `ReactDOM.render()` → `createRoot()` from `react-dom/client`
4. Fixed `React.FC` implicit children — React 18 types remove implicit `children` from `FC`:
   - `src/components/RerenderBoundary.tsx` — added `children?: React.ReactNode`
   - `src/components/Fencing/FencingCountdown.tsx` — added `children?: React.ReactNode`
5. Removed deprecated `findDOMNode` from `src/components/Toolbar/ActionMenu.js` — replaced with direct `ref.current` access
6. Updated `@types/react-helmet` to `^6.1.11` (compatible with React 18 types)
7. Updated resolutions: `@types/react` → `^18.0.0`, added `@types/react-dom` → `^18.0.0`
8. Updated `CLAUDE.md` architecture section: React 16 → React 18

### What did NOT need to change

- 21 class components — fully supported in React 18
- `@sweetalert/with-react` — works at runtime (uses deprecated `ReactDOM.render` internally, which React 18 still supports); replacement planned in Phase 5
- MUI v4 — compatible with React 18 (dev-mode console warnings expected; replacement in Phase 4)
- react-router v5 — compatible with React 18
- No deprecated lifecycle methods, string refs, or legacy context API found
- Automatic batching (React 18 batches setState in async contexts) — no regressions observed

### Verified

- `yarn start` — Vite dev server on :3020 ✅
- `yarn build` — production build succeeds ✅
- Frontend tests — 225 pass ✅
- Server tests — 158 pass ✅
- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- ESLint + Prettier — pass (pre-existing issues only) ✅
- Playwright E2E — 35 tests pass (chromium) ✅
- Manual testing — grid typing, toolbar actions (check/reveal/reset), pencil mode, chat, navigation ✅

---

## Phase 3: react-router v5 → v6 ✅ COMPLETE

**PR:** [#211](https://github.com/ScaleOvenStove/crosswithfriends/pull/211) (`feature/react-router-v6`)

### What was done

1. Bumped `react-router-dom` from `^5.3.4` to `^6` (installed 6.30.3)
2. Removed `@types/react-router-dom` and `@types/react-router` (types included in v6)
3. **`src/index.js`** — route definitions:
   - `Switch` → `Routes`, `<Route component={X}>` → `<Route element={<X />}>`, `<Redirect>` → `<Navigate>`, removed `exact` props
4. **Created `src/lib/withRouter.js`** — shim HOC for 5 class components that use `match.params` and `location`:
   - `src/pages/Game.js`, `Play.js`, `Replay.js`, `Replays.js`, `Battle.js`
5. **Converted 2 TypeScript pages** from `RouteComponentProps` to `useParams`:
   - `src/pages/Fencing.tsx`, `Room.tsx`
6. **Migrated 5 files** from `useHistory()` to `useNavigate()`:
   - `src/pages/VerifyEmail.js`, `Account.js`, `Profile.js`
   - `src/components/Auth/GoogleCallback.js`, `LoginModal.js`
7. **`src/lib/hooks/useStateParams.ts`** — migrated to `useNavigate` + fixed stale location bug:
   - v5's `history.location` was a mutable live reference; v6's `useLocation()` returns a render-cycle snapshot
   - When multiple filters update quickly, the snapshot goes stale and filters overwrite each other
   - Fixed by reading `window.location.search` directly in the onChange handler
8. `Link` usage across 8 files verified — no changes needed (API unchanged in v6)

### Key gotcha

- **`useParams` returns `string | undefined` in v6** (was `string` in v5) — requires type assertions for params that are guaranteed by route definitions (e.g., `as {rid: string}`)

### Verified

- `yarn start` — Vite dev server on :3020 ✅
- `yarn build` — production build succeeds ✅
- Frontend tests — 347 pass ✅
- Server tests — 158 pass ✅
- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- ESLint + Prettier — pass (0 warnings) ✅
- Manual testing — all routes, filters, browser nav, auth flows, upload ✅

---

## Phase 4: MUI v4 → Plain CSS + Radix Dialog/Tabs ✅ COMPLETE

**PR:** [#213](https://github.com/ScaleOvenStove/crosswithfriends/pull/213) (`feature/remove-mui`)

### What was done

Removed `@material-ui/core` (~300KB+ gzipped with JSS runtime) entirely, replaced with plain HTML/CSS + Radix primitives for accessible Dialog/Tabs only.

1. **Group 1 — Trivial standalone (4 changes):**
   - `useMediaQuery` → custom hook `src/lib/hooks/useMediaQuery.ts` (matchMedia + listener)
   - `Tooltip` in Cell.tsx → native `title` attribute on div
   - `Tooltip` in Replay.js → native `title` attribute on SVG icon
   - `makeStyles` in Stats.tsx → inline `style={{textAlign: 'center'}}`

2. **Group 2 — makeStyles → CSS (6 files):**
   - Room.tsx → `src/pages/css/room.css`
   - Fencing.tsx → `src/components/Fencing/css/fencing.css`
   - FencingCountdown.tsx → `src/components/Fencing/css/fencingCountdown.css`
   - FencingScoreboard.tsx → appended to existing `css/fencingScoreboard.css`
   - ColorPicker.tsx → inline style (dynamic color prop)
   - WelcomeVariantsControl.tsx → `src/components/css/welcomeVariantsControl.css` (with dark mode)

3. **Group 3 — Shared CSS primitives:**
   - Created `src/components/common/css/primitives.css` (imported globally in index.js)
   - Spinner: `@keyframes spin`, `.spinner`, `.spinner--small` + dark mode
   - Buttons: `.btn`, `.btn--contained`, `.btn--outlined`, `.btn--primary`, `.btn--danger`, `.btn--small` + dark mode
   - Form fields: `.form-field` with label-above-input, `.form-field--helper` + dark mode
   - Typography: `.text-error`, `.text-secondary`, `.text-success`, `.text-caption`, `.text-body2`, `.text-h6` + dark mode

4. **Group 4 — Auth pages (6 files):**
   - GoogleCallback.js — CircularProgress/Typography → spinner/p tags
   - Profile.js — CircularProgress → spinner
   - ForgotPassword.js — full form conversion (TextField, Button, CircularProgress, Typography)
   - ResetPassword.js — full form conversion (2 password fields)
   - VerifyEmail.js — multiple states (verifying, success, error, resend)
   - Account.js — most complex (6 sub-sections, multiple edit forms)

5. **Group 5 — LoginModal → Radix:**
   - Installed `@radix-ui/react-dialog` + `@radix-ui/react-tabs` (~5KB total)
   - Dialog → Radix Portal + Overlay + Content (focus trapping, Escape, backdrop click)
   - Tabs → Radix Root + List + Trigger + Content (keyboard nav, ARIA)
   - Tab state changed from numeric (0/1) to string ("login"/"signup")
   - Created `src/components/Auth/css/loginModal.css`

6. **Group 6 — Cleanup:**
   - Removed 14 `.Mui*` selectors from `src/dark.css`
   - Removed `.Mui*` selectors from `src/pages/css/account.css`
   - Updated `src/__tests__/darkMode.test.tsx` (MuiDialog-root → login-modal--panel)
   - Removed `@material-ui/core` from dependencies
   - Updated CLAUDE.md styling notes

### Visual change

MUI TextFields had floating/animated labels. Replacement uses simpler label-above-input pattern. This is a deliberate simplification.

### Net result

- **Removed:** `@material-ui/core` + transitive JSS packages (~300KB+ gzipped)
- **Added:** `@radix-ui/react-dialog` + `@radix-ui/react-tabs` (~5KB total)
- **31 files changed**, 7 new CSS files, 1 new hook, -249 net lines

### Verified

- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- `npx eslint . --ext .js,.jsx,.ts,.tsx` — 0 warnings ✅
- Frontend tests — 347 pass ✅
- Server tests — 158 pass ✅
- `yarn build` — production build succeeds ✅
- Manual testing — login modal, account page, auth pages, fencing, replay controls, dark mode ✅

---

## Phase 5: Small Dependency Replacements ✅ COMPLETE

**PR:** [#214](https://github.com/ScaleOvenStove/crosswithfriends/pull/214) (`feature/small-dep-replacements`)

### What was done

Replaced 7 outdated/unmaintained dependencies and upgraded 2 others across ~35 files.

1. **`react-icons` v3 → v5** (9 files) — Drop-in upgrade, no code changes needed
2. **`moment` → plain `Date` arithmetic** (3 files) — No replacement library needed
   - `src/lib/powerups.js` — `moment.duration().asSeconds()` → `(Date.now() - t) / 1000`
   - `server/model/puzzle_solve.ts` — `moment.Moment` types → `Date`, `.format()` → `.toISOString().slice(0,10)`
   - `server/__tests__/api/stats.test.ts` — `moment()` → `new Date()`
3. **`react-linkify` → `linkify-react`** (1 file) — API-compatible drop-in
4. **`react-color` → custom swatch picker** (1 file) — Built simple 18-color swatch grid, no new dep needed
5. **`react-timestamp` → `Intl.DateTimeFormat`** (2 files) — Created `src/lib/formatTimestamp.ts` helper
6. **`@sweetalert/with-react` → Radix Dialog** (3 files + 3 new) — Created reusable `ConfirmDialog` and `InfoDialog` components with icon support, warning color variant, dark mode, and mobile-responsive sizing
   - `src/components/Toolbar/index.js` — Reveal + Reset confirmation dialogs
   - `src/components/common/Nav.js` — About info modal
   - `src/components/WelcomeVariantsControl.tsx` — Fencing info modal
   - Cleaned up ~110 lines of `.swal-*` CSS from `dark.css` and `style.css`
7. **`react-dropzone` v4 → v14** (1 file) — Converted class component to function component with `useDropzone()` hook
8. **`react-flexview` → CSS flexbox** (15 files) — Added flex utility classes (`.flex`, `.flex--column`, `.flex--grow`, etc.) to `primitives.css` with `min-width: 0`/`min-height: 0` to match react-flexview defaults. `classnames` added as direct dependency (was transitive via react-flexview).

### Net result

- **Removed:** `moment`, `@sweetalert/with-react`, `sweetalert`, `react-flexview`, `react-linkify`, `react-color`, `react-timestamp`
- **Added:** `linkify-react`, `linkifyjs`, `classnames` (direct dep)
- **Upgraded:** `react-icons` v3 → v5, `react-dropzone` v4 → v14
- **Bundle size:** 495KB → 424KB gzipped (**-71KB**)

### Verified

- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- `npx eslint . --ext .js,.jsx,.ts,.tsx` — 0 warnings ✅
- Frontend tests — 347 pass ✅
- Server tests — 158 pass ✅
- `yarn build` — production build succeeds ✅
- Manual testing — icons, dialogs, file upload, color picker, flex layouts, dark mode, mobile ✅

---

## Phase 6: React 18 → 19 ✅ COMPLETE

**PR:** [#216](https://github.com/ScaleOvenStove/crosswithfriends/pull/216) (`feature/react-19`)

### What was done

1. Bumped `react`, `react-dom` to `^19` (installed 19.2.4)
2. Bumped `@types/react` to `^19` (19.2.14), `@types/react-dom` to `^19` (19.2.3)
3. Updated `resolutions` in package.json from `^18.0.0` to `^19.0.0`
4. **Replaced `react-helmet` → `react-helmet-async`** (17 files):
   - Added `<HelmetProvider>` wrapper in `src/index.js`
   - Mechanical import change in all 17 files using `<Helmet>`
   - No API changes — `<Helmet><title>...</title></Helmet>` works identically
5. **Simplified `Context.Provider`** (2 files):
   - `src/index.js`: `<GlobalContext.Provider value={...}>` → `<GlobalContext value={...}>`
   - `src/lib/AuthContext.js`: `<AuthContext.Provider value={value}>` → `<AuthContext value={value}>`
6. **Fixed `JSX` namespace** in `src/components/Player/ClueText.ts`:
   - Added `import type {JSX} from 'react'` (global JSX namespace removed in @types/react@19)
7. **Removed string ref** in `src/components/Player/Clues.js`:
   - Template literal `ref={`clues--list--${dir}`}` caused React 19 runtime crash ("Expected ref to be a function...")
   - Ref was unused (never accessed via `this.refs`) — removed entirely

### What did NOT need to change

- No `forwardRef` usage in codebase
- `React.createRef()` in 12 class components — still works in React 19
- `getDerivedStateFromProps` in 2 class components — still works in React 19
- All deps already compatible: react-router-dom ^6, react-dropzone ^14, react-icons ^5, Radix UI ^1.1, linkify-react ^4, react-confetti ^5

### Follow-up PRs

- [#217](https://github.com/ScaleOvenStove/crosswithfriends/pull/217) — Fixed E2E toolbar tests (`.swal-*` selectors → `.confirm-dialog--*`)
- [#218](https://github.com/ScaleOvenStove/crosswithfriends/pull/218) — Updated CLAUDE.md: React 18 → React 19

### Verified

- `yarn tsc --noEmit` — frontend type check ✅
- `yarn tsc --noEmit -p server/tsconfig.json` — server type check ✅
- `npx eslint . --ext .js,.jsx,.ts,.tsx` — 0 warnings ✅
- Frontend tests — 347 pass ✅
- Server tests — 158 pass ✅
- `yarn build` — production build succeeds (438KB gzipped) ✅
- Playwright E2E — 105 tests pass (3 browsers) against testing.crosswithfriends.com ✅
- Manual testing — page titles, game loading, auth flow, dark mode, no deprecated lifecycle warnings ✅

---

## Phase 7: Firebase Upgrade + New Project Migration (Separate Epic)

**This is the biggest single effort.** Firebase Realtime Database is the client-side data store for games, puzzles, battles, and user profiles (12 files). We'll upgrade the SDK from v7 → v11 (modular SDK) and migrate off the legacy `crosswordsio` / `dfac-fa059` Firebase projects to a new CWF-owned Firebase project.

> **Note:** This phase needs its own detailed plan when we get to it. The below is a high-level outline.

### Current Firebase usage (12 files)

- **`src/store/firebase.js`** — init with legacy project configs, time sync via `.info/serverTimeOffset`
- **`src/store/game.js`** — `db.ref(path)` for game state (also has Socket.IO alongside)
- **`src/store/puzzle.js`** — `db.ref(path)` for puzzle data + stats + puzzlelist
- **`src/store/battle.js`** — `db.ref(path)` for battle mode state
- **`src/store/user.js`** — `firebase.auth()` (disabled: `disableFbLogin = true`), `db.ref('user/${id}')` for user data
- **`src/store/demoGame.js`** — imports `SERVER_TIME`
- **`src/store/index.js`** — imports `offline` flag
- **`src/actions.js`** — Firebase auth operations
- **`src/components/Toolbar/Clock.js`** — `getTime()` for synchronized clocks
- **`src/components/Player/Player.js`** — `getTime()` for timing

### Current project configs (in `src/store/firebase.js`)

- **Production:** `crosswordsio` (crosswordsio.firebaseapp.com)
- **Development:** `dfac-fa059` (dfac-fa059.firebaseapp.com)

### Steps (high-level)

**Part A: Upgrade Firebase SDK v7 → v11 (modular)**

1. Install `firebase@^11` (replaces `firebase@^7`)
2. Rewrite `src/store/firebase.js` to use modular imports:
   - `import { initializeApp } from 'firebase/app'`
   - `import { getDatabase, ref, onValue, set, push, get, serverTimestamp } from 'firebase/database'`
   - `import { getAuth, onAuthStateChanged } from 'firebase/auth'` (if keeping auth)
3. Update all store files to use modular API:
   - `db.ref(path).on('value', cb)` → `onValue(ref(db, path), cb)`
   - `db.ref(path).set(val)` → `set(ref(db, path), val)`
   - `db.ref(path).child(x).push(val)` → `push(ref(db, \`${path}/${x}\`), val)`
   - `db.ref(path).once('value')` → `get(ref(db, path))`
   - `firebase.database.ServerValue.TIMESTAMP` → `serverTimestamp()`
4. Update `src/store/user.js` auth calls to modular API
5. Update `src/actions.js` Firebase operations

**Part B: Create new Firebase project + data migration**

1. Create new Firebase project for CWF (new project, new configs)
2. Update config in `src/store/firebase.js` with new project credentials
3. Set up Realtime Database rules on new project
4. Migrate data from old `crosswordsio` project to new project (one-time script)
5. Update `firebase-admin` in backfill scripts to point to new project
6. Optionally: also upgrade `firebase-admin` from v8 → v13 in backfill scripts

**Part C: Clean up legacy Firebase auth (optional)**

- `disableFbLogin` is already `true` — Firebase Auth is unused
- Remove Firebase Auth imports and dead code paths
- Remove Facebook auth provider code

### Verify

- App connects to new Firebase project
- Game creation, joining, playing all work
- Puzzle loading works
- Time sync (`getTime()`) still accurate
- No references to old `crosswordsio` or `dfac-fa059` projects
- Backfill scripts work against new project
- Tree-shaking: bundle size should decrease (modular SDK only includes what's imported)

---

## Phase 8: Housekeeping (Low Priority, Anytime)

These can be done opportunistically between phases:

- **Yarn classic → pnpm** — ✅ DONE — migrated to pnpm 10 via corepack, converted resolutions to pnpm.overrides, updated CI and docs
- **Node 18 → 20** — ✅ DONE ([PR #219](https://github.com/ScaleOvenStove/crosswithfriends/pull/219)) — `.nvmrc` + `engines` updated
- **Prettier 2 → 3** — ✅ DONE ([PR #220](https://github.com/ScaleOvenStove/crosswithfriends/pull/220)) — bumped to 3.8.1, accepted new `trailingComma: "all"` default, 15 files reformatted
- **ESLint flat config** — ✅ DONE ([PR #223](https://github.com/ScaleOvenStove/crosswithfriends/pull/223)) — migrated to flat config (eslint.config.mjs), ESLint 8 → 9
- **Backfill script deps** — 7 scripts in `backfills/`, only 2 have problematic deps: `dumpPuzzles.js` (aws-sdk v2 deprecated, bluebird unmaintained) and `archive.js` (request-promise deprecated, bluebird). Other 5 scripts use only firebase-admin v8 (outdated but functional). All are offline one-shot scripts, low priority to upgrade.

---

## Execution Order Summary

```
Phase 1: CRA → Vite + Vitest + TS5 + remove dead deps     ✅ COMPLETE (PR #205)
Phase 2: React 17 → 18                                     ✅ COMPLETE (PR #207)
Phase 3: react-router v5 → v6                              ✅ COMPLETE (PR #211)
Phase 4: MUI v4 → Plain CSS + Radix Dialog/Tabs            ✅ COMPLETE (PR #213)
Phase 5: Small dep replacements                             ✅ COMPLETE (PR #214)
Phase 6: React 18 → 19                                     ✅ COMPLETE (PR #216)
Phase 7: Firebase v7 → v11 + new project migration          ← deferred (separate epic)
Phase 8: Housekeeping                                        ← in progress (Node 20, Prettier 3 done)
```

Each phase is independently deployable and testable. No phase depends on a later phase. If any phase stalls, the others still deliver value.
