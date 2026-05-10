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
import {lazyWithReload, clearChunkReloadMarker} from './lib/lazyWithReload';
// Eager-loaded pages (critical path)
import {Game, Room, WrappedWelcome} from './pages';

// Lazy-loaded pages (loaded on demand when route is visited).
// lazyWithReload force-reloads once per session if the chunk fetch fails — handles
// the common case where a deploy lands while a tab is open and the hashed asset
// URLs in the loaded HTML no longer exist.
const Account = lazyWithReload(() => import('./pages/Account'));
const Fencing = lazyWithReload(() => import('./pages/Fencing'));
const ForgotPassword = lazyWithReload(() => import('./pages/ForgotPassword'));
const Help = lazyWithReload(() => import('./pages/Help'));
const Play = lazyWithReload(() => import('./pages/Play'));
const Privacy = lazyWithReload(() => import('./pages/Privacy'));
const Profile = lazyWithReload(() => import('./pages/Profile'));
const Replay = lazyWithReload(() => import('./pages/Replay'));
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'));
const Terms = lazyWithReload(() => import('./pages/Terms'));
const VerifyEmail = lazyWithReload(() => import('./pages/VerifyEmail'));
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
// Successful boot — clear any pending reload marker so a future deploy can trigger
// a fresh reload-on-chunk-failure.
clearChunkReloadMarker();
