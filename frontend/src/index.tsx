// React 19 compatibility shim - must be imported first
import './utils/react19-compat';

import GlobalContext from '@crosswithfriends/shared/lib/GlobalContext';
import {isMobile} from '@crosswithfriends/shared/lib/jsUtils';
import {useMediaQuery, ThemeProvider, CssBaseline} from '@mui/material';
import {QueryClientProvider} from '@tanstack/react-query';
import classnames from 'classnames';
import React, {lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';

import {queryClient} from './api/react-query';
import {AccountError} from './components/common/AccountError';
import ErrorBoundary from './components/common/ErrorBoundary';
import {GameError} from './components/common/GameError';
import LoadingSpinner from './components/common/LoadingSpinner';
import OfflineIndicator from './components/common/OfflineIndicator';
import {RoomError} from './components/common/RoomError';
import {createAppTheme} from './theme/theme';
import {logger} from './utils/logger';

// Lazy load page components for code splitting
const Account = lazy(() => import('./pages/Account'));
const Battle = lazy(() => import('./pages/Battle'));
const Compose = lazy(() => import('./pages/Compose'));
const Composition = lazy(() => import('./pages/Composition'));
const Game = lazy(() => import('./pages/Game'));
const Play = lazy(() => import('./pages/Play'));
const Replay = lazy(() => import('./pages/Replay'));
const Replays = lazy(() => import('./pages/Replays'));
const Room = lazy(() => import('./pages/Room'));
const Fencing = lazy(() => import('./pages/Fencing'));
const WrappedWelcome = lazy(() => import('./pages/WrappedWelcome'));

import './style.css';
import './dark.css';

// Loading component for route transitions
const RouteLoading: React.FC = () => <LoadingSpinner message="Loading page..." fullScreen />;

const darkModeLocalStorageKey = 'dark_mode_preference';

const DiscordRedirect: React.FC = () => {
  React.useEffect(() => {
    window.location.href = 'https://discord.gg/RmjCV8EZ73';
  }, []);
  return null;
};

const Root: React.FC = () => {
  const urlDarkMode = window.location.search.indexOf('dark') !== -1;
  const savedDarkModePreference = (localStorage && localStorage.getItem(darkModeLocalStorageKey)) || '0';
  const [darkModePreference, setDarkModePreference] = React.useState<string>(
    urlDarkMode ? '1' : savedDarkModePreference
  );

  // Initialize dark class on html element immediately to prevent flash (Tailwind CSS best practice)
  React.useEffect(() => {
    const initialPreference = urlDarkMode ? '1' : savedDarkModePreference;
    const initialDarkMode =
      initialPreference === '2'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : initialPreference === '1';
    const htmlElement = document.documentElement;
    if (initialDarkMode) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const toggleMolesterMoons = () => {
    let newDarkModePreference: string;
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

  // Create theme with dynamic breakpoints and dark mode support
  const theme = React.useMemo(() => createAppTheme(darkMode), [darkMode]);

  // Sync dark class with html element (Tailwind CSS best practice)
  React.useEffect(() => {
    const htmlElement = document.documentElement;
    if (darkMode) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <GlobalContext.Provider value={{toggleMolesterMoons, darkModePreference}}>
              <OfflineIndicator />
              <div className={classnames('router-wrapper', {mobile: isMobile()})}>
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<WrappedWelcome fencing={false} />} />
                    <Route path="/fencing" element={<WrappedWelcome fencing={true} />} />
                    {/* <Route path="/stats" element={<Stats />} /> */}
                    <Route
                      path="/game/:gid"
                      element={
                        <ErrorBoundary fallback={<GameError />}>
                          <Game />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/embed/game/:gid"
                      element={
                        <ErrorBoundary fallback={<GameError />}>
                          <Game />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/room/:rid"
                      element={
                        <ErrorBoundary fallback={<RoomError />}>
                          <Room />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/embed/room/:rid"
                      element={
                        <ErrorBoundary fallback={<RoomError />}>
                          <Room />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/replay/:gid" element={<Replay />} />
                    <Route path="/beta/replay/:gid" element={<Replay />} />
                    <Route path="/replays/:pid" element={<Replays />} />
                    <Route path="/replays" element={<Replays />} />
                    <Route path="/beta" element={<WrappedWelcome fencing={false} />} />
                    <Route
                      path="/beta/game/:gid"
                      element={
                        <ErrorBoundary fallback={<GameError />}>
                          <Game />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/beta/battle/:bid" element={<Battle />} />
                    <Route path="/beta/play/:pid" element={<Play />} />
                    <Route
                      path="/account"
                      element={
                        <ErrorBoundary fallback={<AccountError />}>
                          <Account />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/compose" element={<Compose />} />
                    <Route path="/composition/:cid" element={<Composition />} />
                    <Route
                      path="/fencing/:gid"
                      element={
                        <ErrorBoundary fallback={<GameError />}>
                          <Fencing />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/beta/fencing/:gid"
                      element={
                        <ErrorBoundary fallback={<GameError />}>
                          <Fencing />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="/discord" element={<DiscordRedirect />} />
                  </Routes>
                </Suspense>
              </div>
            </GlobalContext.Provider>
          </Router>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
/*
createRoot(document.getElementById('root')!).render(
  <h4 style={{marginLeft: 10}}>down for a maintenance</h4>
);
*/
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
} else {
  logger.error('Root element not found');
}
