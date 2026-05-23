import * as Sentry from '@sentry/react';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
      Sentry.consoleLoggingIntegration({levels: ['warn', 'error']}),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    ignoreErrors: [
      // Network failures (Safari / Chrome / Firefox) — client-side connectivity issues
      /^TypeError: Load failed$/,
      /^TypeError: Failed to fetch$/,
      /^TypeError: NetworkError when attempting to fetch resource\.$/,
      /^TypeError: cancelled$/,
      /Event delivery failed after all retries/,
      // Browser extensions
      /feature named .* was not found/,
      /Invalid call to runtime\.sendMessage/,
      // DuckDuckGo Mobile browser internals
      /^invalid origin$/,
      // Cross-origin iframe (extensions / ad blockers)
      /Blocked a frame with origin/,
      /Failed to read a named property .* from 'Window'/,
      // Safari privacy restrictions
      /^The operation is insecure\.$/,
      // Clipboard permission denied
      /Write permission denied/,
      // Stale assets after deploy
      /Unable to preload CSS/,
      /Importing a module script failed/,
    ],
  });
}

import clsx from 'clsx';
import {createRoot} from 'react-dom/client';
import React from 'react';
import {HelmetProvider} from 'react-helmet-async';

import useMediaQuery from './lib/hooks/useMediaQuery';
import {BrowserRouter as Router, Route, Routes, Navigate, useLocation} from 'react-router';
import {isMobile} from './lib/jsUtils';
// Eager-loaded pages (critical path)
import {Game, Room, WrappedWelcome} from './pages';

// Lazy-loaded pages (loaded on demand when route is visited).
// When a deploy ships new bundle hashes, users with a stale index.html will
// try to fetch the previous chunk filenames and 404. Catch that case and
// force-reload once per route to pick up the new index.html + hashes.
const CHUNK_RELOAD_KEY_PREFIX = 'cwf:chunk-reload-attempted:';
const isChunkLoadError = (err) => {
  const message = String(err?.message || err || '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  );
};
// sessionStorage can throw SecurityError in privacy-restricted modes
// (Safari "Block All Cookies", some embedded WebViews, in-app browsers).
// Treat any read/write failure as "no flag set" so we don't bubble the
// error up into the lazy import.
const safeStorageGet = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeStorageSet = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
};
const safeStorageRemove = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
};
// URL-param fallback guard for environments where sessionStorage is
// unavailable (storage-only guard would loop forever on a genuinely
// broken chunk because every read returns null and every write no-ops).
// The URL persists across the reload itself, so the next page boot can
// detect "we already tried" and fall through to the error boundary
// instead of looping.
const CHUNK_RELOAD_URL_PARAM = '_cwf_chunk_reload';
const readUrlReloadAttempts = () => {
  try {
    const value = new URLSearchParams(window.location.search).get(CHUNK_RELOAD_URL_PARAM);
    return value ? value.split(',').filter(Boolean) : [];
  } catch {
    return [];
  }
};
const urlHasReloadAttempt = (name) => readUrlReloadAttempts().includes(name);
const reloadWithUrlGuard = (name) => {
  try {
    const url = new URL(window.location.href);
    const attempts = readUrlReloadAttempts();
    if (!attempts.includes(name)) attempts.push(name);
    url.searchParams.set(CHUNK_RELOAD_URL_PARAM, attempts.join(','));
    window.location.replace(url.toString());
  } catch {
    // URL APIs unavailable — fall back to a plain reload. If storage is
    // also unavailable in this environment we may loop, but there's no
    // way to prevent that without one of the two persistence channels.
    window.location.reload();
  }
};
const clearUrlReloadAttempt = (name) => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CHUNK_RELOAD_URL_PARAM)) return;
    const remaining = readUrlReloadAttempts().filter((n) => n !== name);
    if (remaining.length > 0) {
      url.searchParams.set(CHUNK_RELOAD_URL_PARAM, remaining.join(','));
    } else {
      url.searchParams.delete(CHUNK_RELOAD_URL_PARAM);
    }
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* no-op */
  }
};
// `name` keys the per-route reload guard. Without per-route keying, a
// reload triggered by route A failing would be cleared the moment route B
// loads successfully, so a genuinely broken route A would loop-reload on
// every subsequent visit instead of falling through to React's error
// boundary. Tying the guard to the specific import keeps the loop bounded
// per route, and the URL fallback keeps the loop bounded even when
// sessionStorage is unavailable.
const lazyWithRetry = (name, importFn) =>
  React.lazy(async () => {
    const key = `${CHUNK_RELOAD_KEY_PREFIX}${name}`;
    try {
      const mod = await importFn();
      // Same-route success — clear both guard channels so a *future* stale
      // deploy affecting the same route can trigger another reload.
      safeStorageRemove(key);
      clearUrlReloadAttempt(name);
      return mod;
    } catch (err) {
      const alreadyAttempted = safeStorageGet(key) === '1' || urlHasReloadAttempt(name);
      if (isChunkLoadError(err) && !alreadyAttempted) {
        safeStorageSet(key, '1');
        // reloadWithUrlGuard also appends the route to the URL param so the
        // guard survives a session-storage-less reload.
        reloadWithUrlGuard(name);
        // Hang the import so React doesn't render the error boundary during
        // the reload window.
        return new Promise(() => {});
      }
      throw err;
    }
  });

const Account = lazyWithRetry('Account', () => import('./pages/Account'));
const Fencing = lazyWithRetry('Fencing', () => import('./pages/Fencing'));
const ForgotPassword = lazyWithRetry('ForgotPassword', () => import('./pages/ForgotPassword'));
const Help = lazyWithRetry('Help', () => import('./pages/Help'));
const Play = lazyWithRetry('Play', () => import('./pages/Play'));
const Privacy = lazyWithRetry('Privacy', () => import('./pages/Privacy'));
const Profile = lazyWithRetry('Profile', () => import('./pages/Profile'));
const Replay = lazyWithRetry('Replay', () => import('./pages/Replay'));
const ResetPassword = lazyWithRetry('ResetPassword', () => import('./pages/ResetPassword'));
const Terms = lazyWithRetry('Terms', () => import('./pages/Terms'));
const VerifyEmail = lazyWithRetry('VerifyEmail', () => import('./pages/VerifyEmail'));
import GlobalContext from './lib/GlobalContext';
import AuthContext, {AuthProvider} from './lib/AuthContext';
import GoogleCallback from './components/Auth/GoogleCallback';

import './style.css';
import './dark.css';
import './components/common/css/primitives.css';

const darkModeLocalStorageKey = 'dark_mode_preference';

// Gate that redirects unverified email users to /verify-email
function VerificationGate({children}) {
  const {user, isAuthenticated, loading} = React.useContext(AuthContext);
  const location = useLocation();

  if (loading) return children;
  if (!isAuthenticated) return children;

  // If user is verified (or Google OAuth auto-verified), pass through
  if (user?.emailVerified) return children;

  // Allow these paths even when unverified
  const allowedPaths = ['/verify-email', '/account', '/profile', '/privacy', '/terms', '/help'];
  if (allowedPaths.some((p) => location.pathname.startsWith(p))) return children;

  // Redirect unverified users to the verify-email page
  return <Navigate to="/verify-email" replace />;
}

const DiscordRedirect = () => {
  React.useEffect(() => {
    window.location.href = 'https://discord.gg/RmjCV8EZ73';
  }, []);
  return null;
};

function DarkModeSync({darkModePreference, setDarkModePreference}) {
  const {isAuthenticated, preferences, savePreference} = React.useContext(AuthContext);
  const prevPrefRef = React.useRef(darkModePreference);
  const initialSyncDone = React.useRef(false);

  // When server preferences arrive on login, update dark mode state
  React.useEffect(() => {
    if (isAuthenticated && preferences?.darkMode != null && !initialSyncDone.current) {
      initialSyncDone.current = true;
      if (preferences.darkMode !== darkModePreference) {
        setDarkModePreference(preferences.darkMode);
      }
    }
    if (!isAuthenticated) {
      initialSyncDone.current = false;
    }
  }, [isAuthenticated, preferences, darkModePreference, setDarkModePreference]);

  // When user toggles dark mode, sync to server
  React.useEffect(() => {
    if (prevPrefRef.current !== darkModePreference && isAuthenticated) {
      savePreference('darkMode', darkModePreference);
    }
    prevPrefRef.current = darkModePreference;
  }, [darkModePreference, isAuthenticated, savePreference]);

  return null;
}

const Root = () => {
  const urlDarkMode = window.location.search.indexOf('dark') !== -1;
  const savedDarkModePreference = (localStorage && localStorage.getItem(darkModeLocalStorageKey)) || '0';
  const [darkModePreference, setDarkModePreference] = React.useState(
    urlDarkMode ? '1' : savedDarkModePreference
  );

  const toggleMolesterMoons = () => {
    let newDarkModePreference;
    switch (darkModePreference) {
      case '0':
        newDarkModePreference = '1';
        break;
      case '1':
        newDarkModePreference = '2';
        break;
      case '2':
      default:
        newDarkModePreference = '0';
    }
    localStorage && localStorage.setItem(darkModeLocalStorageKey, newDarkModePreference);
    setDarkModePreference(newDarkModePreference);
  };

  const systemDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const darkMode = darkModePreference === '2' ? systemDarkMode : darkModePreference === '1';

  // Sync dark class to document.body so MUI portals (Dialog, Menu, etc.) pick it up
  React.useEffect(() => {
    document.body.classList.toggle('dark', !!darkMode);
  }, [darkMode]);

  return (
    <HelmetProvider>
      <Router>
        <AuthProvider>
          <GlobalContext value={{toggleMolesterMoons, darkModePreference, setDarkModePreference}}>
            <DarkModeSync
              darkModePreference={darkModePreference}
              setDarkModePreference={setDarkModePreference}
            />
            <div className={clsx('router-wrapper', {mobile: isMobile(), dark: darkMode})}>
              <VerificationGate>
                <React.Suspense fallback={null}>
                  <Routes>
                    <Route path="/auth/google/callback" element={<GoogleCallback />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/" element={<WrappedWelcome />} />
                    <Route path="/fencing" element={<WrappedWelcome fencing />} />
                    <Route path="/game/:gid" element={<Game />} />
                    <Route path="/embed/game/:gid" element={<Game />} />
                    <Route path="/room/:rid" element={<Room />} />
                    <Route path="/embed/room/:rid" element={<Room />} />
                    <Route path="/replay/:gid" element={<Replay />} />
                    <Route path="/beta/replay/:gid" element={<Replay />} />
                    <Route path="/beta" element={<WrappedWelcome />} />
                    <Route path="/beta/game/:gid" element={<Game />} />
                    <Route path="/beta/play/:pid" element={<Play />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/:userId" element={<Profile />} />
                    <Route path="/fencing/:gid" element={<Fencing />} />
                    <Route path="/beta/fencing/:gid" element={<Fencing />} />
                    <Route path="/discord" element={<DiscordRedirect />} />
                  </Routes>
                </React.Suspense>
              </VerificationGate>
            </div>
          </GlobalContext>
        </AuthProvider>
      </Router>
    </HelmetProvider>
  );
};
/*
ReactDOM.render(
  <h4 style={{marginLeft: 10}}>down for a maintenance</h4>,
  document.getElementById('root')
);
*/
createRoot(document.getElementById('root')).render(<Root />);
